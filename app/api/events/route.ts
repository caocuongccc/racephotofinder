import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { slugify } from '@/lib/utils'

// GET /api/events - Lấy danh sách events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')

    const where = active === 'true' ? { isActive: true } : {}

    const events = await prisma.event.findMany({
      where,
      include: {
        _count: {
          select: {
            photos: true,
            runners: true,
          },
        },
      },
      orderBy: {
        eventDate: 'desc',
      },
    })

    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/events - Tạo event mới
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'uploader')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, eventDate, location, description } = body

    if (!name || !eventDate) {
      return NextResponse.json(
        { error: 'Name and event date are required' },
        { status: 400 }
      )
    }

    // Generate slug
    let slug = slugify(name)
    
    // Check if slug exists, add number if needed
    const existingEvent = await prisma.event.findUnique({
      where: { slug },
    })

    if (existingEvent) {
      slug = `${slug}-${Date.now()}`
    }

    const event = await prisma.event.create({
      data: {
        name,
        slug,
        eventDate: new Date(eventDate),
        location,
        description,
        createdBy: session.user.id,
        isActive: true,
      },
    })

    // If uploader created event, give them permission
    if (session.user.role === 'uploader') {
      await prisma.eventPermission.create({
        data: {
          eventId: event.id,
          uploaderId: session.user.id,
          canUpload: true,
          canDelete: true,
        },
      })
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}