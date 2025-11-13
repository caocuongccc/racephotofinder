import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateNAPASQR, generatePaymentReference } from '@/lib/qr-code'
import QRCode from 'qrcode'

// POST /api/payments/create - Create payment request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, photoId, userEmail, userName, userPhone } = body

    if (!eventId || !photoId || !userEmail) {
      return NextResponse.json(
        { error: 'Event ID, photo ID and email are required' },
        { status: 400 }
      )
    }

    // Get payment config
    const config = await prisma.paymentConfig.findUnique({
      where: { eventId },
      include: { event: true },
    })

    if (!config || !config.isEnabled) {
      return NextResponse.json(
        { error: 'Payment not enabled for this event' },
        { status: 400 }
      )
    }

    if (config.pricePerPhoto === 0) {
      return NextResponse.json(
        { error: 'This event offers free downloads' },
        { status: 400 }
      )
    }

    // Check if photo exists
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    })

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Generate transaction code
    const transactionCode = generatePaymentReference(eventId, photoId)

    // Generate transfer content
    const transferContent = `${transactionCode} ${config.event.name}`

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        paymentConfigId: config.id,
        photoId,
        userEmail,
        userName,
        userPhone,
        amount: config.pricePerPhoto,
        transactionCode,
        transferContent,
        status: 'pending',
      },
    })

    // Generate QR code with amount and transaction code
    const qrData = generateNAPASQR({
      bankInfo: {
        bankId: config.qrCodeData?.substring(
          config.qrCodeData.indexOf('0107A000000727') + 18,
          config.qrCodeData.indexOf('0107A000000727') + 24
        ) || '',
        accountNo: config.bankAccountNo!,
        accountName: config.bankAccountName!,
      },
      amount: config.pricePerPhoto,
      description: transferContent.substring(0, 25),
      transactionId: transactionCode,
    })

    // Generate QR code image (base64)
    const qrCodeImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })

    return NextResponse.json({
      payment: {
        id: payment.id,
        amount: payment.amount,
        transactionCode: payment.transactionCode,
        transferContent: payment.transferContent,
        status: payment.status,
      },
      bankInfo: {
        bankName: config.bankName,
        accountNo: config.bankAccountNo,
        accountName: config.bankAccountName,
      },
      qrCode: qrCodeImage,
    })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}