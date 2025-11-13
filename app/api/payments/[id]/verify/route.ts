import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getDirectDownloadUrl } from '@/lib/google-drive'

// POST /api/payments/[id]/verify - Admin verify payment
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
    const { status, notes } = body // 'verified' or 'rejected'

    if (!['verified', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Get payment
    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      include: {
        photo: true,
        paymentConfig: {
          include: { event: true },
        },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { id: params.id },
      data: {
        status: status as any,
        verifiedBy: session.user.id,
        verifiedAt: new Date(),
        notes,
      },
    })

    // If verified, send email with download link
    if (status === 'verified' && payment.photo) {
      const downloadUrl = await getDirectDownloadUrl(payment.photo.driveFileId) // 24 hours

      await sendEmail({
        to: payment.userEmail,
        subject: `✅ Thanh toán đã được xác nhận - ${payment.paymentConfig.event.name}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                          color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #10b981; 
                          color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .info-box { background: #e0f2fe; border-left: 4px solid #0284c7; padding: 15px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Thanh toán thành công!</h1>
                </div>
                <div class="content">
                  <p>Xin chào <strong>${payment.userName || payment.userEmail}</strong>,</p>
                  
                  <p>Thanh toán của bạn đã được xác nhận thành công!</p>
                  
                  <div class="info-box">
                    <p><strong>Thông tin thanh toán:</strong></p>
                    <p>Mã giao dịch: <strong>${payment.transactionCode}</strong></p>
                    <p>Số tiền: <strong>${payment.amount.toLocaleString('vi-VN')} VNĐ</strong></p>
                    <p>Sự kiện: <strong>${payment.paymentConfig.event.name}</strong></p>
                  </div>
                  
                  <p>Bạn có thể tải ảnh của mình theo link dưới đây:</p>
                  
                  <a href="${downloadUrl}" class="button">
                    Tải ảnh ngay
                  </a>
                  
                  <p style="margin-top: 30px; color: #666; font-size: 14px;">
                    ⚠️ Link tải có hiệu lực trong 24 giờ. Vui lòng tải ảnh trong thời gian này.
                  </p>
                  
                  <p style="color: #666; font-size: 14px;">
                    Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
      })

      // Mark as completed
      await prisma.payment.update({
        where: { id: params.id },
        data: { status: 'completed' },
      })
    } else if (status === 'rejected') {
      // Send rejection email
      await sendEmail({
        to: payment.userEmail,
        subject: `❌ Thanh toán không được xác nhận - ${payment.paymentConfig.event.name}`,
        html: `
          <!DOCTYPE html>
          <html>
            <body>
              <p>Xin chào <strong>${payment.userName || payment.userEmail}</strong>,</p>
              
              <p>Rất tiếc, thanh toán của bạn không được xác nhận.</p>
              
              <p><strong>Lý do:</strong> ${notes || 'Không tìm thấy giao dịch'}</p>
              
              <p>Vui lòng kiểm tra lại thông tin chuyển khoản và thử lại.</p>
              
              <p>Nếu bạn đã chuyển khoản đúng, vui lòng liên hệ với chúng tôi.</p>
            </body>
          </html>
        `,
      })
    }

    return NextResponse.json({ success: true, payment: updatedPayment })
  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/payments/[id] - Check payment status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        amount: true,
        transactionCode: true,
        status: true,
        createdAt: true,
        verifiedAt: true,
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}