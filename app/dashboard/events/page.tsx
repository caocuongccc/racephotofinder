'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Calendar, MapPin, Plus, Edit, Trash2, Upload, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Event {
  id: string
  name: string
  slug: string
  eventDate: string
  location?: string
  description?: string
  isActive: boolean
  _count: {
    photos: number
    runners: number
  }
}

export default function EventsManagementPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    eventDate: '',
    location: '',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events')
      const data = await response.json()
      setEvents(data)
    } catch (error) {
      toast.error('Không thể tải danh sách sự kiện')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to create event')

      toast.success('Tạo sự kiện thành công!')
      setShowModal(false)
      setFormData({ name: '', eventDate: '', location: '', description: '' })
      fetchEvents()
    } catch (error) {
      toast.error('Không thể tạo sự kiện')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý sự kiện</h1>
          <p className="text-gray-600 mt-1">Tạo và quản lý các giải chạy</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-5 w-5 mr-2" />
          Tạo sự kiện
        </Button>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">Chưa có sự kiện nào</p>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Tạo sự kiện đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {event.name}
                </h3>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    {formatDate(event.eventDate)}
                  </div>

                  {event.location && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2" />
                      {event.location}
                    </div>
                  )}
                </div>

                {event.description && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {event.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 mb-4">
                  <div className="flex space-x-4 text-sm text-gray-600">
                    <span>{event._count.photos} ảnh</span>
                    <span>{event._count.runners} VĐV</span>
                  </div>
                  <div
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      event.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {event.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/dashboard/events/${event.id}/runners`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <Users className="h-4 w-4 mr-1" />
                      VĐV
                    </Button>
                  </Link>
                  <Link href={`/dashboard/upload?event=${event.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Tạo sự kiện mới">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Tên sự kiện"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="VD: Dalat Ultra Trail 2024"
          />

          <Input
            label="Ngày diễn ra"
            type="date"
            value={formData.eventDate}
            onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
            required
          />

          <Input
            label="Địa điểm"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="VD: Đà Lạt, Lâm Đồng"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Mô tả ngắn về sự kiện..."
            />
          </div>

          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
              className="flex-1"
            >
              Hủy
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              Tạo sự kiện
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}