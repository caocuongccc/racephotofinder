import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// POST /api/photos/[id]/faces - Save face embeddings for photo
export async function POST(
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
    const { faces } = body // Array of { embedding, boundingBox }

    if (!faces || !Array.isArray(faces)) {
      return NextResponse.json(
        { error: 'Faces array is required' },
        { status: 400 }
      )
    }

    // Verify photo exists
    const photo = await prisma.photo.findUnique({
      where: { id: params.id },
    })

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Delete existing face embeddings for this photo
    await prisma.$executeRaw`
      DELETE FROM face_embeddings WHERE photo_id = ${params.id}::uuid
    `

    // Insert new face embeddings
    for (const face of faces) {
      const embeddingArray = `[${face.embedding.join(',')}]`
      
      await prisma.$executeRaw`
        INSERT INTO face_embeddings (photo_id, embedding, bounding_box)
        VALUES (
          ${params.id}::uuid,
          ${embeddingArray}::vector,
          ${JSON.stringify(face.boundingBox)}::jsonb
        )
      `
    }

    return NextResponse.json({ success: true, count: faces.length })
  } catch (error) {
    console.error('Error saving face embeddings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/photos/[id]/faces - Get face embeddings for photo
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await prisma.$queryRaw<Array<{
      id: string
      embedding: string
      bounding_box: any
    }>>`
      SELECT 
        id::text,
        embedding::text,
        bounding_box
      FROM face_embeddings
      WHERE photo_id = ${params.id}::uuid
    `

    const faces = result.map((row) => ({
      id: row.id,
      embedding: row.embedding,
      boundingBox: row.bounding_box,
    }))

    return NextResponse.json({ faces })
  } catch (error) {
    console.error('Error fetching face embeddings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}