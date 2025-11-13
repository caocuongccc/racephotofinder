import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/admin/permissions - Get all permissions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = await prisma.eventPermission.findMany({
      include: {
        event: {
          select: {
            id: true,
            name: true,
          },
        },
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(permissions)
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/permissions - Create permission
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { eventId, uploaderId, canUpload, canDelete } = body

    if (!eventId || !uploaderId) {
      return NextResponse.json(
        { error: 'Event ID and uploader ID are required' },
        { status: 400 }
      )
    }

    // Check if permission already exists
    const existing = await prisma.eventPermission.findUnique({
      where: {
        eventId_uploaderId: {
          eventId,
          uploaderId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Permission already exists' },
        { status: 400 }
      )
    }

    const permission = await prisma.eventPermission.create({
      data: {
        eventId,
        uploaderId,
        canUpload,
        canDelete,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
          },
        },
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(permission, { status: 201 })
  } catch (error) {
    console.error('Error creating permission:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}