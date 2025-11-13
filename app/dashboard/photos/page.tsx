'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Image as ImageIcon, Tag, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface Event {
  id: string
  name: string
}

interface Runner {
  id: string
  bibNumber: string
  fullName: string
}

interface Photo {
  id: string
  thumbnailUrl: string
  photoUrl: string
  tags: Array<{
    id: string
    runner: Runner
  }>
}

export default function PhotosManagementPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [runners, setRunners] = useState<Runner[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [selectedRunners, setSelectedRunners] = useState<string[]>([])
  const [runnerSearch, setRunnerSearch] = useState('')
  const [processingOcr, setProcessingOcr] = useState<string | null>(null)
  const [batchProcessing, setBatchProcessing] = useState(false)

  const handleBatchProcess = async () => {
    if (!selectedEventId) return
    if (!confirm('Xử lý tất cả ảnh chưa tag bằng OCR? (tối đa 50 ảnh)')) return

    setBatchProcessing(true)
    try {
      const response = await fetch('/api/photos/batch-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEventId, processType: 'ocr' }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error('Batch process failed')

      toast.success(`Đã xử lý ${data.processed}/${data.totalPhotos} ảnh!`)
      fetchPhotos()
    } catch (error) {
      toast.error('Không thể xử lý batch')
    } finally {
      setBatchProcessing(false)
    }
  }

  const handleOcrTag = async (photoId: string) => {
    setProcessingOcr(photoId)
    try {
      const response = await fetch(`/api/photos/${photoId}/ocr`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) throw new Error('OCR failed')

      if (data.matchedRunners > 0) {
        toast.success(`Tìm thấy ${data.matchedRunners} VĐV và đã tag tự động!`)
        fetchPhotos()
      } else {
        toast('Không tìm thấy số BIB trong ảnh')
      }
    } catch (error) {
      toast.error('Không thể xử lý OCR')
    } finally {
      setProcessingOcr(null)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchPhotos()
      fetchRunners()
    }
  }, [selectedEventId])

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events?active=true')
      const data = await response.json()
      setEvents(data)
    } catch (error) {
      toast.error('Không thể tải danh sách sự kiện')
    }
  }

  const fetchPhotos = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/events/${selectedEventId}/photos?limit=100`)
      const data = await response.json()
      setPhotos(data.photos)
    } catch (error) {
      toast.error('Không thể tải ảnh')
    } finally {
      setLoading(false)
    }
  }

  const fetchRunners = async () => {
    try {
      const response = await fetch(`/api/events/${selectedEventId}/runners`)
      const data = await response.json()
      setRunners(data)
    } catch (error) {
      toast.error('Không thể tải danh sách VĐV')
    }
  }

  const openTagModal = (photo: Photo) => {
    setSelectedPhoto(photo)
    setSelectedRunners(photo.tags.map((t) => t.runner.id))
    setRunnerSearch('')
  }

  const handleTagPhoto = async () => {
    if (!selectedPhoto) return

    try {
      const response = await fetch(`/api/photos/${selectedPhoto.id}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runnerIds: selectedRunners }),
      })

      if (!response.ok) throw new Error('Failed to tag photo')

      toast.success('Đã tag ảnh thành công')
      setSelectedPhoto(null)
      fetchPhotos()
    } catch (error) {
      toast.error('Không thể tag ảnh')
    }
  }

  const toggleRunner = (runnerId: string) => {
    setSelectedRunners((prev) =>
      prev.includes(runnerId)
        ? prev.filter((id) => id !== runnerId)
        : [...prev, runnerId]
    )
  }

  const filteredRunners = runners.filter(
    (runner) =>
      runner.bibNumber.toLowerCase().includes(runnerSearch.toLowerCase()) ||
      runner.fullName.toLowerCase().includes(runnerSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quản lý ảnh</h1>
        <p className="text-gray-600 mt-1">Tag và quản lý ảnh đã upload</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chọn sự kiện</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Chọn sự kiện --</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedEventId && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : photos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">Chưa có ảnh nào</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {photos.map((photo) => (
                <Card key={photo.id} className="overflow-hidden">
                  <img
                    src={photo.thumbnailUrl}
                    alt="Photo"
                    className="w-full h-48 object-cover"
                  />
                  <CardContent className="p-3 space-y-2">
                    {photo.tags.length > 0 ? (
                      <div className="text-xs text-gray-600">
                        <p className="font-medium">Tagged:</p>
                        {photo.tags.slice(0, 2).map((tag) => (
                          <p key={tag.id}>BIB {tag.runner.bibNumber}</p>
                        ))}
                        {photo.tags.length > 2 && (
                          <p className="text-blue-600">+{photo.tags.length - 2} more</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Chưa tag</p>
                    )}
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTagModal(photo)}
                        className="w-full"
                      >
                        <Tag className="h-4 w-4 mr-1" />
                        Tag
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOcrTag(photo.id)}
                        loading={processingOcr === photo.id}
                        className="w-full"
                        title="Auto-tag bằng OCR"
                      >
                        <Tag className="h-4 w-4 mr-1" />
                        OCR
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tag Modal */}
      {selectedPhoto && (
        <Modal
          isOpen={!!selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          title="Tag ảnh với VĐV"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <img
                src={selectedPhoto.thumbnailUrl}
                alt="Photo"
                className="w-full rounded-lg"
              />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm VĐV (BIB hoặc tên)..."
                value={runnerSearch}
                onChange={(e) => setRunnerSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="max-h-96 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
              {filteredRunners.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Không tìm thấy VĐV</p>
              ) : (
                filteredRunners.map((runner) => (
                  <label
                    key={runner.id}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRunners.includes(runner.id)}
                      onChange={() => toggleRunner(runner.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1 text-sm">
                      <span className="font-medium">BIB {runner.bibNumber}</span> -{' '}
                      {runner.fullName}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="flex space-x-2">
              <Button onClick={() => setSelectedPhoto(null)} variant="outline" className="flex-1">
                Hủy
              </Button>
              <Button onClick={handleTagPhoto} className="flex-1">
                Lưu ({selectedRunners.length} VĐV)
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}