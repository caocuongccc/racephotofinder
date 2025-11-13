'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface User {
  id: string
  name: string
  email: string
}

interface Event {
  id: string
  name: string
}

interface Permission {
  id: string
  eventId: string
  uploaderId: string
  canUpload: boolean
  canDelete: boolean
  event: Event
  uploader: User
}

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    eventId: '',
    uploaderId: '',
    canUpload: true,
    canDelete: false,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [permissionsRes, usersRes, eventsRes] = await Promise.all([
        fetch('/api/admin/permissions'),
        fetch('/api/admin/users'),
        fetch('/api/events'),
      ])

      const [permissionsData, usersData, eventsData] = await Promise.all([
        permissionsRes.json(),
        usersRes.json(),
        eventsRes.json(),
      ])

      setPermissions(permissionsData)
      setUsers(usersData.filter((u: User & { role: string }) => u.role === 'uploader'))
      setEvents(eventsData)
    } catch (error) {
      toast.error('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to create permission')

      toast.success('Phân quyền thành công!')
      setShowModal(false)
      setFormData({ eventId: '', uploaderId: '', canUpload: true, canDelete: false })
      fetchData()
    } catch (error) {
      toast.error('Không thể phân quyền')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (permissionId: string) => {
    if (!confirm('Bạn có chắc muốn xóa quyền này?')) return

    try {
      const response = await fetch(`/api/admin/permissions/${permissionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete permission')

      toast.success('Xóa quyền thành công')
      fetchData()
    } catch (error) {
      toast.error('Không thể xóa quyền')
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
          <h1 className="text-3xl font-bold text-gray-900">Quản lý phân quyền</h1>
          <p className="text-gray-600 mt-1">Phân quyền uploader cho các sự kiện</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-5 w-5 mr-2" />
          Thêm quyền
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Uploader
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sự kiện
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Quyền
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {permissions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Chưa có phân quyền nào
                    </td>
                  </tr>
                ) : (
                  permissions.map((permission) => (
                    <tr key={permission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {permission.uploader.name}
                          </div>
                          <div className="text-sm text-gray-500">{permission.uploader.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{permission.event.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          {permission.canUpload && (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                              Upload
                            </span>
                          )}
                          {permission.canDelete && (
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                              Delete
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDelete(permission.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Permission Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Phân quyền mới">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Uploader <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.uploaderId}
              onChange={(e) => setFormData({ ...formData, uploaderId: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Chọn uploader --</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sự kiện <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.eventId}
              onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Chọn sự kiện --</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.canUpload}
                onChange={(e) => setFormData({ ...formData, canUpload: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Cho phép upload ảnh</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.canDelete}
                onChange={(e) => setFormData({ ...formData, canDelete: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Cho phép xóa ảnh</span>
            </label>
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
              Phân quyền
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}