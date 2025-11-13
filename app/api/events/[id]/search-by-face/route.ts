import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getThumbnailUrl, getDirectDownloadUrl } from '@/lib/google-drive'

// POST /api/events/[id]/search-by-face - Search photos by face similarity
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { embedding, limit = 20 } = body

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json(
        { error: 'Face embedding is required' },
        { status: 400 }
      )
    }

    const embeddingStr = `[${embedding.join(',')}]`

    // Find similar faces using cosine distance
    // Lower distance = more similar
    const similarFaces = await prisma.$queryRaw<Array<{
      photo_id: string
      similarity: number
      bounding_box: any
    }>>`
      SELECT 
        photo_id::text,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity,
        bounding_box
      FROM face_embeddings fe
      JOIN photos p ON p.id = fe.photo_id
      WHERE p.event_id = ${(await context.params).id}::uuid
        AND p.is_processed = true
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `

    // Filter by similarity threshold (0.6 is typical for face recognition)
    const matchedFaces = similarFaces.filter((face) => face.similarity >= 0.6)

    // Get photo details
    const photoIds = matchedFaces.map((f) => f.photo_id)
    
    if (photoIds.length === 0) {
      return NextResponse.json({ photos: [] })
    }

    const photos = await prisma.photo.findMany({
      where: {
        id: { in: photoIds },
      },
      include: {
        tags: {
          include: {
            runner: true,
          },
        },
      },
    })

    // Add URLs and similarity scores
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        const matchedFace = matchedFaces.find((f) => f.photo_id === photo.id)
        const [thumbnailUrl, photoUrl] = await Promise.all([
          photo.driveThumbnailId
            ? getThumbnailUrl(photo.driveThumbnailId, 3600)
            : getDirectDownloadUrl(photo.driveFileId),
          getDirectDownloadUrl(photo.driveFileId),
        ])

        return {
          ...photo,
          thumbnailUrl,
          photoUrl,
          similarity: matchedFace?.similarity || 0,
          faceBox: matchedFace?.bounding_box,
        }
      })
    )

    // Sort by similarity
    photosWithUrls.sort((a, b) => b.similarity - a.similarity)

    return NextResponse.json({ photos: photosWithUrls })
  } catch (error) {
    console.error('Error searching by face:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}