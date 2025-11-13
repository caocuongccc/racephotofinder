import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = process.env.R2_BUCKET_NAME!

/**
 * Generate presigned URL for uploading file to R2
 */
export async function generateUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 }) // 1 hour
  return url
}

/**
 * Generate presigned URL for downloading file from R2
 */
export async function generateDownloadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  const url = await getSignedUrl(r2Client, command, { expiresIn })
  return url
}

/**
 * Upload file directly to R2 (server-side)
 */
export async function uploadToR2(key: string, body: Buffer, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  })

  await r2Client.send(command)
  return key
}

/**
 * Delete file from R2
 */
export async function deleteFromR2(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await r2Client.send(command)
}

/**
 * Get public URL for file (if bucket has public access)
 */
export function getPublicUrl(key: string) {
  return `${process.env.R2_PUBLIC_URL}/${key}`
}

/**
 * Generate unique file key
 */
export function generateFileKey(eventId: string, filename: string, type: 'original' | 'thumbnail' = 'original') {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const ext = filename.split('.').pop()
  
  if (type === 'thumbnail') {
    return `events/${eventId}/thumbnails/${timestamp}-${random}.${ext}`
  }
  
  return `events/${eventId}/photos/${timestamp}-${random}.${ext}`
}