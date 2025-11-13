import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'

// Initialize Firebase Admin (server-side)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}

export const storage = getStorage()
export const bucket = storage.bucket()

/**
 * Upload file to Firebase Storage
 */
export async function uploadToFirebase(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const file = bucket.file(path)
  
  await file.save(buffer, {
    metadata: {
      contentType,
    },
  })

  // Make file public (optional)
  await file.makePublic()

  // Return public URL
  return `https://storage.googleapis.com/${bucket.name}/${path}`
}

/**
 * Generate signed URL for upload (client can upload directly)
 */
export async function generateUploadUrl(
  path: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const file = bucket.file(path)

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 3600 * 1000, // 1 hour
    contentType,
  })

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${path}`

  return { uploadUrl, publicUrl }
}

/**
 * Generate signed URL for download
 */
export async function generateDownloadUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const file = bucket.file(path)

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresIn * 1000,
  })

  return url
}

/**
 * Delete file from Firebase Storage
 */
export async function deleteFromFirebase(path: string): Promise<void> {
  const file = bucket.file(path)
  await file.delete()
}

/**
 * Get public URL (if file is public)
 */
export function getPublicUrl(path: string): string {
  return `https://storage.googleapis.com/${bucket.name}/${path}`
}

/**
 * Generate unique file key
 */
export function generateFileKey(
  eventId: string,
  filename: string,
  type: 'original' | 'thumbnail' | 'watermarked' = 'original'
): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const ext = filename.split('.').pop()

  if (type === 'thumbnail') {
    return `events/${eventId}/thumbnails/${timestamp}-${random}.${ext}`
  } else if (type === 'watermarked') {
    return `events/${eventId}/watermarked/${timestamp}-${random}.${ext}`
  }

  return `events/${eventId}/photos/${timestamp}-${random}.${ext}`
}