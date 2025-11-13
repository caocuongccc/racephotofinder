import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import sharp from 'sharp'
import { uploadToGoogleDrive, generateFileKey } from '@/lib/google-drive'

// POST /api/photos/[id]/confirm - Confirm upload and process photo
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const params = await context.params
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Get photo record
    const photo = await prisma.photo.findUnique({
      where: { id: params.id },
    })

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Verify uploader
    if (photo.uploadedBy !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Get image metadata
      const metadata = await sharp(buffer).metadata()

      // Generate thumbnail (max 400px width)
      const thumbnailBuffer = await sharp(buffer)
        .resize(400, null, {
          withoutEnlargement: true,
          fit: 'inside',
        })
        .jpeg({ quality: 80 })
        .toBuffer()

      // Generate watermarked version for preview
      const watermarkText = 'RacePhoto Finder - Preview'
      const watermarkedBuffer = await sharp(buffer)
        .resize(1200, null, {
          withoutEnlargement: true,
          fit: 'inside',
        })
        .composite([
          {
            input: Buffer.from(
              `<svg width="1200" height="100">
                <text x="50%" y="50" 
                  font-family="Arial" 
                  font-size="36" 
                  fill="rgba(255,255,255,0.5)" 
                  text-anchor="middle">
                  ${watermarkText}
                </text>
              </svg>`
            ),
            gravity: 'center',
          },
        ])
        .jpeg({ quality: 85 })
        .toBuffer()

      // Upload to Google Drive
      const originalKey = generateFileKey(photo.eventId, photo.originalFilename!, 'original')
      const thumbnailKey = generateFileKey(photo.eventId, photo.originalFilename!, 'thumbnail')
      const watermarkedKey = generateFileKey(photo.eventId, photo.originalFilename!, 'watermarked')

      const [originalUpload, thumbnailUpload] = await Promise.all([
        uploadToGoogleDrive(originalKey.fileName, buffer, 'image/jpeg', originalKey.folderPath),
        uploadToGoogleDrive(thumbnailKey.fileName, thumbnailBuffer, 'image/jpeg', thumbnailKey.folderPath),
      ])

      // Update photo record
      const updatedPhoto = await prisma.photo.update({
        where: { id: params.id },
        data: {
          driveFileId: originalUpload.fileId,
          driveThumbnailId: thumbnailUpload.fileId,
          width: metadata.width,
          height: metadata.height,
          fileSize: buffer.length,
          isProcessed: true,
        },
      })

      return NextResponse.json({
        success: true,
        photo: updatedPhoto,
      })
    } catch (processError) {
      console.error('Error processing image:', processError)
      return NextResponse.json({ error: 'Failed to process image' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error confirming upload:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}