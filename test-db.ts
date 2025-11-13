import prisma from './lib/prisma'

async function test() {
  try {
    console.log('Testing database connection...')
    
    const users = await prisma.user.findMany()
    console.log('✅ Connection successful!')
    console.log('Users found:', users.length)
    console.log('Users:', users)
  } catch (error) {
    console.error('❌ Database connection failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

test()