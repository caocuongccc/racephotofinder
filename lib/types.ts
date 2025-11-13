import { UserRole } from '@prisma/client'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
}

export interface Event {
  id: string
  name: string
  slug: string
  eventDate: Date
  location?: string
  description?: string
  isActive: boolean
}

export interface Runner {
  id: string
  eventId: string
  bibNumber: string
  fullName: string
  category?: string
  team?: string
}

export interface Photo {
  id: string
  eventId: string
  fileKey: string
  thumbnailKey?: string
  originalFilename?: string
  uploadDate: Date
  fileSize?: number
  width?: number
  height?: number
  downloadCount: number
  thumbnailUrl?: string
  photoUrl?: string
}

export interface PhotoWithTags extends Photo {
  tags: {
    runner: Runner
    confidence: number
  }[]
}

export interface FaceEmbedding {
  id: string
  photoId: string
  embedding: number[]
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  runnerId?: string
}

export interface SearchResult {
  photo: Photo
  runner?: Runner
  similarity?: number
}

export interface UploadProgress {
  filename: string
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
}