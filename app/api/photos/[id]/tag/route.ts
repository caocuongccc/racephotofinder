import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// POST /api/photos/[id]/tag - Tag photo với runners
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
    const { runnerIds } = body // Array of runner IDs

    if (!runnerIds || !Array.isArray(runnerIds)) {
      return NextResponse.json(
        { error: 'Runner IDs array is required' },
        { status: 400 }
      )
    }

    // Verify photo exists
    const photo = await prisma.photo.findUnique({
      where: { id: params.id },
    })

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Delete existing tags
    await prisma.photoTag.deleteMany({
      where: { photoId: params.id },
    })

    // Create new tags
    if (runnerIds.length > 0) {
      await prisma.photoTag.createMany({
        data: runnerIds.map((runnerId: string) => ({
          photoId: params.id,
          runnerId,
          confidence: 1.0, // Manual tagging = 100% confidence
          taggedBy: session.user.id,
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tagging photo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/photos/[id]/tag - Get photo tags
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tags = await prisma.photoTag.findMany({
      where: { photoId: params.id },
      include: {
        runner: true,
      },
    })

    return NextResponse.json(tags)
  } catch (error) {
    console.error('Error fetching photo tags:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}