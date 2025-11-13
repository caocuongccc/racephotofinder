import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getDirectDownloadUrl } from '@/lib/google-drive'
import { extractBibNumbers } from '@/lib/ocr'

// POST /api/photos/[id]/ocr - Extract BIB numbers using OCR
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'uploader')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get photo
    const photo = await prisma.photo.findUnique({
      where: { id: params.id },
      include: { event: true },
    })

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Get photo URL
    const photoUrl = await getDirectDownloadUrl(photo.driveFileId)

    // Extract BIB numbers
    const detections = await extractBibNumbers(photoUrl)

    if (detections.length === 0) {
      return NextResponse.json({
        success: true,
        bibNumbers: [],
        message: 'No BIB numbers detected',
      })
    }

    // Find matching runners
    const runners = await prisma.runner.findMany({
      where: {
        eventId: photo.eventId,
        bibNumber: {
          in: detections.map((d) => d.bibNumber),
        },
      },
    })

    // Auto-tag photo with detected runners
    if (runners.length > 0) {
      // Delete existing tags
      await prisma.photoTag.deleteMany({
        where: { photoId: params.id },
      })

      // Create new tags
      await prisma.photoTag.createMany({
        data: runners.map((runner) => {
          const detection = detections.find((d) => d.bibNumber === runner.bibNumber)
          return {
            photoId: params.id,
            runnerId: runner.id,
            confidence: detection?.confidence || 0.5,
            taggedBy: session.user.id,
          }
        }),
      })
    }

    return NextResponse.json({
      success: true,
      detections,
      matchedRunners: runners.length,
      bibNumbers: detections.map((d) => d.bibNumber),
    })
  } catch (error) {
    console.error('OCR error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}