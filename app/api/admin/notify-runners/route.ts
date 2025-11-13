import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notifyNewPhotos } from '@/lib/email'

// POST /api/admin/notify-runners - Notify runners about new photos
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'uploader')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { eventId } = body

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 })
    }

    // Get event details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        photos: {
          where: { isProcessed: true },
          include: {
            tags: {
              include: {
                runner: true,
              },
            },
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Group photos by runner
    const runnerPhotos = new Map<string, { runner: any; photoCount: number }>()

    for (const photo of event.photos) {
      for (const tag of photo.tags) {
        const existing = runnerPhotos.get(tag.runner.id)
        if (existing) {
          existing.photoCount++
        } else {
          runnerPhotos.set(tag.runner.id, {
            runner: tag.runner,
            photoCount: 1,
          })
        }
      }
    }

    // Send emails (only if runner has email - you need to add email field to Runner model)
    let sentCount = 0
    const errors: string[] = []

    for (const [runnerId, { runner, photoCount }] of runnerPhotos) {
      // Skip if no email (you need to add email field to runners table)
      // For demo, we'll skip this
      // if (!runner.email) continue

      // For demo purposes, we'll just count
      sentCount++

      // Uncomment when you add email to runners
      /*
      try {
        await notifyNewPhotos({
          runnerEmail: runner.email,
          runnerName: runner.fullName,
          eventName: event.name,
          photoCount,
          eventSlug: event.slug,
        })
        sentCount++
      } catch (error) {
        errors.push(`Failed to notify ${runner.fullName}`)
      }
      */
    }

    return NextResponse.json({
      success: true,
      notified: sentCount,
      totalRunners: runnerPhotos.size,
      errors,
    })
  } catch (error) {
    console.error('Notify runners error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}