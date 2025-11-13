import nodemailer from 'nodemailer'

// Create transporter (using Gmail as example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // App password, not regular password
  },
})

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

/**
 * Send email
 */
export async function sendEmail({ to, subject, html }: SendEmailParams) {
  try {
    const info = await transporter.sendMail({
      from: `"RacePhoto Finder" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    })

    console.log('Email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email error:', error)
    return { success: false, error }
  }
}

/**
 * Send notification when new photos are uploaded
 */
export async function notifyNewPhotos(params: {
  runnerEmail: string
  runnerName: string
  eventName: string
  photoCount: number
  eventSlug: string
}) {
  const { runnerEmail, runnerName, eventName, photoCount, eventSlug } = params

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; 
                    color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📸 Ảnh mới của bạn đã có!</h1>
          </div>
          <div class="content">
            <p>Xin chào <strong>${runnerName}</strong>,</p>
            
            <p>Chúng tôi vừa upload <strong>${photoCount} ảnh mới</strong> 
               từ sự kiện <strong>${eventName}</strong>!</p>
            
            <p>Ảnh của bạn đã sẵn sàng để xem và tải về.</p>
            
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/events/${eventSlug}" class="button">
              Xem ảnh ngay
            </a>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              💡 <strong>Mẹo:</strong> Bạn có thể tìm ảnh của mình bằng cách:
            </p>
            <ul style="color: #666; font-size: 14px;">
              <li>Nhập số BIB của bạn</li>
              <li>Tìm theo tên</li>
              <li>Upload ảnh của bạn để tìm ảnh giống</li>
            </ul>
          </div>
          <div class="footer">
            <p>RacePhoto Finder - Tìm ảnh chạy bộ của bạn</p>
            <p>Nếu bạn không tham gia sự kiện này, vui lòng bỏ qua email này.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return await sendEmail({
    to: runnerEmail,
    subject: `📸 ${photoCount} ảnh mới từ ${eventName}`,
    html,
  })
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(params: {
  email: string
  name: string
  role: string
}) {
  const { email, name, role } = params

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; 
                    color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Chào mừng đến RacePhoto Finder!</h1>
          </div>
          <div class="content">
            <p>Xin chào <strong>${name}</strong>,</p>
            
            <p>Tài khoản <strong>${role}</strong> của bạn đã được tạo thành công!</p>
            
            <p>Bạn có thể đăng nhập và bắt đầu sử dụng hệ thống ngay bây giờ.</p>
            
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" class="button">
              Đăng nhập ngay
            </a>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Nếu bạn cần hỗ trợ, vui lòng liên hệ admin.
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  return await sendEmail({
    to: email,
    subject: 'Chào mừng đến RacePhoto Finder',
    html,
  })
}