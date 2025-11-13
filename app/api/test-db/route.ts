import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    // Debug: Check if env is loaded
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
    console.log('DATABASE_URL preview:', process.env.DATABASE_URL?.substring(0, 30) + '...')
    
    const users = await prisma.user.findMany()
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      userCount: users.length,
      envLoaded: !!process.env.DATABASE_URL,
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      envLoaded: !!process.env.DATABASE_URL,
      databaseUrl: process.env.DATABASE_URL ? 'EXISTS' : 'MISSING',
    }, { status: 500 })
  }
}
