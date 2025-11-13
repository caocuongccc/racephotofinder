import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getThumbnailUrl } from '@/lib/google-drive'

// GET /api/admin/payments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'uploader')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        paymentConfig: {
          include: {
            event: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        photo: {
          select: {
            id: true,
            driveThumbnailId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Add thumbnail URLs
    const paymentsWithUrls = await Promise.all(
      payments.map(async (payment) => {
        let thumbnailUrl = null
        if (payment.photo?.driveThumbnailId) {
          thumbnailUrl = await getThumbnailUrl(payment.photo?.driveThumbnailId, 3600)
        }

        return {
          ...payment,
          photo: payment.photo ? { ...payment.photo, thumbnailUrl } : null,
        }
      })
    )

    return NextResponse.json(paymentsWithUrls)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}