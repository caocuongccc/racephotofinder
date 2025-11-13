import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/events/[id]/runners - Lấy danh sách runners của event
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const where: any = { eventId: params.id }

    if (search) {
      where.OR = [
        { bibNumber: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const runners = await prisma.runner.findMany({
      where,
      orderBy: [
        { bibNumber: 'asc' },
      ],
    })

    return NextResponse.json(runners)
  } catch (error) {
    console.error('Error fetching runners:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/events/[id]/runners - Tạo runner mới hoặc bulk import
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'uploader')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { runners } = body // Array of runners for bulk import

    if (!runners || !Array.isArray(runners)) {
      return NextResponse.json(
        { error: 'Runners array is required' },
        { status: 400 }
      )
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check permission for uploader
    if (session.user.role === 'uploader') {
      const permission = await prisma.eventPermission.findUnique({
        where: {
          eventId_uploaderId: {
            eventId: params.id,
            uploaderId: session.user.id,
          },
        },
      })

      if (!permission || !permission.canUpload) {
        return NextResponse.json({ error: 'No permission' }, { status: 403 })
      }
    }

    // Bulk create runners
    const createdRunners = await prisma.runner.createMany({
      data: runners.map((runner: any) => ({
        eventId: params.id,
        bibNumber: runner.bibNumber,
        fullName: runner.fullName,
        category: runner.category || null,
        team: runner.team || null,
      })),
      skipDuplicates: true, // Skip if bib number already exists
    })

    return NextResponse.json(
      { success: true, count: createdRunners.count },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating runners:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}