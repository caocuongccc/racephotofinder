import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateNAPASQR } from '@/lib/qr-code'

// GET /api/admin/payment-config/[eventId]
export async function GET(req: NextRequest, context: { params: Promise<{ eventId: string }> })
 {
  try {
    const config = await prisma.paymentConfig.findUnique({
      where: { eventId: context.params },
    })

    return NextResponse.json(config || null)
  } catch (error) {
    console.error('Error fetching payment config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
 
// POST /api/admin/payment-config/[eventId] - Create or update
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      pricePerPhoto,
      bankName,
      bankAccountNo,
      bankAccountName,
      bankId,
      notificationEmail,
      isEnabled,
    } = body

    // Generate QR code data
    let qrCodeData = null
    if (bankId && bankAccountNo && bankAccountName) {
      qrCodeData = generateNAPASQR({
        bankInfo: {
          bankId,
          accountNo: bankAccountNo,
          accountName: bankAccountName,
        },
        amount: 0, // Amount will be filled when generating specific payment QR
        description: 'Thanh toan anh',
        transactionId: '',
      })
    }

    // Upsert payment config
    const config = await prisma.paymentConfig.upsert({
      where: { eventId: params.eventId },
      create: {
        eventId: params.eventId,
        pricePerPhoto,
        bankName,
        bankAccountNo,
        bankAccountName,
        qrCodeData,
        notificationEmail,
        isEnabled,
      },
      update: {
        pricePerPhoto,
        bankName,
        bankAccountNo,
        bankAccountName,
        qrCodeData,
        notificationEmail,
        isEnabled,
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('Error saving payment config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}