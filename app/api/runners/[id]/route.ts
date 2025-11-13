import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/runners/[id] - Lấy thông tin runner
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const runner = await prisma.runner.findUnique({
      where: { id: params.id },
      include: {
        event: {
          select: {
            name: true,
            slug: true,
          },
        },
        photoTags: {
          include: {
            photo: true,
          },
        },
      },
    })

    if (!runner) {
      return NextResponse.json({ error: 'Runner not found' }, { status: 404 })
    }

    return NextResponse.json(runner)
  } catch (error) {
    console.error('Error fetching runner:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/runners/[id] - Cập nhật runner
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const params = await context.params
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'uploader')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { bibNumber, fullName, category, team } = body

    const runner = await prisma.runner.update({
      where: { id: params.id },
      data: {
        ...(bibNumber && { bibNumber }),
        ...(fullName && { fullName }),
        ...(category !== undefined && { category }),
        ...(team !== undefined && { team }),
      },
    })

    return NextResponse.json(runner)
  } catch (error) {
    console.error('Error updating runner:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/runners/[id] - Xóa runner
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const params = await context.params
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.runner.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting runner:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}