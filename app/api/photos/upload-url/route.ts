import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// POST /api/photos/upload-url - Create photo record (Google Drive upload will be done on confirm)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'uploader')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { eventId, filename, contentType } = body

    if (!eventId || !filename || !contentType) {
      return NextResponse.json(
        { error: 'Event ID, filename and content type are required' },
        { status: 400 }
      )
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check permission for uploader
    if (session.user.role === 'uploader') {
      const permission = await prisma.eventPermission.findUnique({
        where: {
          eventId_uploaderId: {
            eventId,
            uploaderId: session.user.id,
          },
        },
      })

      if (!permission || !permission.canUpload) {
        return NextResponse.json({ error: 'No permission' }, { status: 403 })
      }
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG and WebP are allowed' },
        { status: 400 }
      )
    }

    // Create photo record (fileId will be updated after upload)
    const photo = await prisma.photo.create({
      data: {
        eventId,
        driveFileId: 'pending', // Will be updated on confirm
        originalFilename: filename,
        uploadedBy: session.user.id,
        isProcessed: false,
      },
    })

    return NextResponse.json({
      photoId: photo.id,
      // Client will upload directly as base64 or form data
    })
  } catch (error) {
    console.error('Error creating photo record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}