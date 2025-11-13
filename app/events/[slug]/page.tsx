'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Search, Download, Calendar, MapPin, User, Image as ImageIcon, X, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { SocialShare } from '@/components/social-share'

interface Event {
  id: string
  name: string
  slug: string
  eventDate: string
  location?: string
  description?: string
  _count: {
    photos: number
    runners: number
  }
}

interface Photo {
  id: string
  thumbnailUrl: string
  photoUrl: string
  downloadCount: number
  tags: Array<{
    runner: {
      id: string
      bibNumber: string
      fullName: string
    }
  }>
}

export default function EventDetailPage() {
  const params = useParams()
  const slug = params.slug as string

  const [event, setEvent] = useState<Event | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchType, setSearchType] = useState<'bib' | 'name' | 'face'>('bib')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchImage, setSearchImage] = useState<File | null>(null)
  const [faceDetecting, setFaceDetecting] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchEvent()
  }, [slug])

  const fetchEvent = async () => {
    try {
      const response = await fetch(`/api/events?active=true`)
      const events = await response.json()
      const foundEvent = events.find((e: Event) => e.slug === slug)
      
      if (foundEvent) {
        setEvent(foundEvent)
        fetchPhotos(foundEvent.id)
      }
    } catch (error) {
      toast.error('Không thể tải thông tin sự kiện')
    }
  }

  const fetchPhotos = async (eventId: string, query?: string, type?: 'bib' | 'name' | 'face', currentPage = 1) => {
    try {
      setSearching(true)
      let url = `/api/events/${eventId}/photos?page=${currentPage}`
      
      if (query && type !== 'face') {
        if (type === 'bib') {
          url += `&bib=${encodeURIComponent(query)}`
        } else if (type === 'name') {
          url += `&name=${encodeURIComponent(query)}`
        }
      }

      const response = await fetch(url)
      const data = await response.json()
      
      setPhotos(data.photos)
      setTotalPages(data.pagination.totalPages)
      setPage(currentPage)
    } catch (error) {
      toast.error('Không thể tải ảnh')
    } finally {
      setSearching(false)
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!event) return
    
    if (searchType === 'face' && searchImage) {
      await handleFaceSearch()
    } else if (searchQuery.trim()) {
      fetchPhotos(event.id, searchQuery, searchType, 1)
    } else {
      toast.error('Vui lòng nhập từ khóa tìm kiếm')
    }
  }

  const handleFaceSearch = async () => {
    if (!event || !searchImage) return

    try {
      setFaceDetecting(true)
      toast.loading('Đang phân tích khuôn mặt...')

      // Load face-api models
      // @ts-ignore
      const { loadFaceApiModels, detectFaces } = await import('@/lib/face-detection')
      await loadFaceApiModels()

      // Create image element
      const img = document.createElement('img')
      img.src = URL.createObjectURL(searchImage)
      
      await new Promise((resolve) => {
        img.onload = resolve
      })

      // Detect faces
      const faces = await detectFaces(img)
      
      if (faces.length === 0) {
        toast.dismiss()
        toast.error('Không tìm thấy khuôn mặt trong ảnh')
        return
      }

      if (faces.length > 1) {
        toast.dismiss()
        toast('Phát hiện nhiều khuôn mặt, đang tìm kiếm khuôn mặt đầu tiên...')
      }

      // Use first face for search
      const embedding = Array.from(faces[0].descriptor)

      toast.dismiss()
      toast.loading('Đang tìm kiếm...')

      // Search by face
      const response = await fetch(`/api/events/${event.id}/search-by-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedding, limit: 50 }),
      })

      const data = await response.json()
      
      toast.dismiss()
      
      if (data.photos.length === 0) {
        toast.error('Không tìm thấy ảnh phù hợp')
      } else {
        toast.success(`Tìm thấy ${data.photos.length} ảnh`)
      }

      setPhotos(data.photos)
      setTotalPages(1)
      setPage(1)
    } catch (error) {
      console.error('Face search error:', error)
      toast.dismiss()
      toast.error('Không thể tìm kiếm bằng khuôn mặt')
    } finally {
      setFaceDetecting(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Vui lòng chọn file ảnh')
        return
      }
      setSearchImage(file)
      setSearchQuery('')
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchImage(null)
    if (event) {
      fetchPhotos(event.id)
    }
  }

  const handleDownload = async (photo: Photo) => {
    try {
      const response = await fetch(photo.photoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `photo-${photo.id}.jpg`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Đang tải xuống...')
    } catch (error) {
      toast.error('Không thể tải ảnh')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-12 px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Không tìm thấy sự kiện</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Event Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{event.name}</h1>
          <div className="flex flex-wrap gap-4 text-gray-600">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              {formatDate(event.eventDate)}
            </div>
            {event.location && (
              <div className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                {event.location}
              </div>
            )}
            <div className="flex items-center">
              <ImageIcon className="h-5 w-5 mr-2" />
              {event._count.photos} ảnh
            </div>
            <div className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              {event._count.runners} VĐV
            </div>
          </div>
        </div>

        {/* Search Box */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex space-x-4">
                <button
                  onClick={() => { setSearchType('bib'); setSearchImage(null) }}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    searchType === 'bib'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Tìm theo số BIB
                </button>
                <button
                  onClick={() => { setSearchType('name'); setSearchImage(null) }}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    searchType === 'name'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Tìm theo tên
                </button>
                <button
                  onClick={() => { setSearchType('face'); setSearchQuery('') }}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    searchType === 'face'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Tìm bằng ảnh
                </button>
              </div>

              {searchType === 'face' ? (
                <div className="space-y-2">
                  <input
                    type="file"
                    id="face-search-input"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="face-search-input"
                    className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-md hover:border-blue-500 cursor-pointer transition-colors"
                  >
                    {searchImage ? (
                      <div className="flex items-center space-x-2">
                        <ImageIcon className="h-5 w-5 text-blue-600" />
                        <span className="text-sm text-gray-700">{searchImage.name}</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="mt-1 text-sm text-gray-600">
                          Click để chọn ảnh của bạn
                        </p>
                        <p className="text-xs text-gray-500">
                          Hệ thống sẽ tìm ảnh có khuôn mặt giống bạn
                        </p>
                      </div>
                    )}
                  </label>
                  {searchImage && (
                    <div className="flex space-x-2">
                      <Button onClick={handleSearch} loading={faceDetecting} className="flex-1">
                        <Search className="h-5 w-5 mr-2" />
                        Tìm kiếm
                      </Button>
                      <Button variant="outline" onClick={handleClearSearch}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex space-x-2">
                  <Input
                    placeholder={
                      searchType === 'bib'
                        ? 'Nhập số BIB (VD: 1234)'
                        : 'Nhập tên vận động viên'
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} loading={searching}>
                    <Search className="h-5 w-5" />
                  </Button>
                  {searchQuery && (
                    <Button variant="outline" onClick={handleClearSearch}>
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Photos Grid */}
        {photos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">
                {searchQuery ? 'Không tìm thấy ảnh phù hợp' : 'Chưa có ảnh nào'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img
                    src={photo.thumbnailUrl}
                    alt="Race photo"
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(photo)
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Tải xuống
                    </Button>
                  </div>
                  {photo.tags.length > 0 && (
                    <div className="p-2 bg-white">
                      <p className="text-xs text-gray-600 truncate">
                        BIB: {photo.tags.map((t) => t.runner.bibNumber).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center space-x-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => event && fetchPhotos(event.id, searchQuery || undefined, searchType, page - 1)}
                >
                  Trước
                </Button>
                <span className="px-4 py-2 text-gray-700">
                  Trang {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => event && fetchPhotos(event.id, searchQuery || undefined, searchType, page + 1)}
                >
                  Sau
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <Modal isOpen={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} size="xl">
          <div className="space-y-4">
            <img
              src={selectedPhoto.photoUrl}
              alt="Race photo"
              className="w-full rounded-lg"
            />
            
            {selectedPhoto.tags.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Vận động viên trong ảnh:</h3>
                <div className="space-y-1">
                  {selectedPhoto.tags.map((tag) => (
                    <div key={tag.runner.id} className="flex items-center space-x-2 text-sm">
                      <span className="font-medium">BIB {tag.runner.bibNumber}:</span>
                      <span>{tag.runner.fullName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={() => handleDownload(selectedPhoto)} className="w-full">
              <Download className="h-5 w-5 mr-2" />
              Tải xuống ảnh gốc
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}