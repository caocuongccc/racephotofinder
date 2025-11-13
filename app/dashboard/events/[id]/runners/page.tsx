'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Plus, Upload, Search, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

interface Runner {
  id: string
  bibNumber: string
  fullName: string
  category?: string
  team?: string
}

export default function RunnersManagementPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  const [runners, setRunners] = useState<Runner[]>([])
  const [filteredRunners, setFilteredRunners] = useState<Runner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkData, setBulkData] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchRunners()
  }, [eventId])

  useEffect(() => {
    if (searchQuery) {
      const filtered = runners.filter(
        (runner) =>
          runner.bibNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          runner.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredRunners(filtered)
    } else {
      setFilteredRunners(runners)
    }
  }, [searchQuery, runners])

  const fetchRunners = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/runners`)
      const data = await response.json()
      setRunners(data)
      setFilteredRunners(data)
    } catch (error) {
      toast.error('Không thể tải danh sách VĐV')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkImport = async () => {
    if (!bulkData.trim()) {
      toast.error('Vui lòng nhập dữ liệu')
      return
    }

    setSubmitting(true)

    try {
      // Parse CSV data
      const lines = bulkData.trim().split('\n')
      const runnersData = lines.map((line) => {
        const [bibNumber, fullName, category, team] = line.split(',').map((s) => s.trim())
        return { bibNumber, fullName, category, team }
      })

      const response = await fetch(`/api/events/${eventId}/runners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runners: runnersData }),
      })

      if (!response.ok) throw new Error('Failed to import runners')

      const result = await response.json()
      toast.success(`Đã import ${result.count} VĐV thành công!`)
      setShowBulkModal(false)
      setBulkData('')
      fetchRunners()
    } catch (error) {
      toast.error('Không thể import VĐV')
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quản lý VĐV</h1>
            <p className="text-gray-600 mt-1">{runners.length} vận động viên</p>
          </div>
        </div>
        <Button onClick={() => setShowBulkModal(true)}>
          <Upload className="h-5 w-5 mr-2" />
          Import CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-gray-400" />
            <Input
              placeholder="Tìm kiếm theo BIB hoặc tên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredRunners.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {searchQuery ? 'Không tìm thấy VĐV' : 'Chưa có VĐV nào'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowBulkModal(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Import VĐV
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      BIB
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Họ tên
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cự ly
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Đội
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRunners.map((runner) => (
                    <tr key={runner.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {runner.bibNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{runner.fullName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {runner.category || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{runner.team || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Import VĐV từ CSV"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Nhập dữ liệu VĐV theo định dạng: BIB, Họ tên, Cự ly, Đội (mỗi dòng 1 VĐV)
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Ví dụ:<br />
              1234, Nguyễn Văn A, 42K, Team ABC<br />
              5678, Trần Thị B, 21K, Team XYZ
            </p>
            <textarea
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="1234, Nguyễn Văn A, 42K, Team ABC"
            />
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkModal(false)}
              className="flex-1"
            >
              Hủy
            </Button>
            <Button onClick={handleBulkImport} loading={submitting} className="flex-1">
              Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}