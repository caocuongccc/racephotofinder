import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createAdminUser() {
  const email = 'admin@racephoto.com'
  const password = 'admin123456'
  const name = 'Admin User'

  try {
    // Check if admin exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      console.log('❌ Admin user already exists')
      return
    }

    // Hash password
    const passwordHash = await hash(password, 10)

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'admin',
        isActive: true,
      },
    })

    console.log('✅ Admin user created successfully!')
    console.log('Email:', email)
    console.log('Password:', password)
    console.log('⚠️  Please change the password after first login!')
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdminUser()