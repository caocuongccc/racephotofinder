'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, ChevronLeft, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NotifyRunnersPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleNotify = async () => {
    if (!confirm('Gửi email thông báo cho tất cả VĐV có ảnh?')) return

    setSending(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/notify-runners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error('Failed to send notifications')

      setResult(data)
      toast.success(`Đã gửi thông báo đến ${data.notified} VĐV!`)
    } catch (error) {
      toast.error('Không thể gửi thông báo')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gửi thông báo</h1>
          <p className="text-gray-600 mt-1">Thông báo VĐV về ảnh mới</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gửi email thông báo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Chức năng email thông báo
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Hệ thống sẽ gửi email cho tất cả VĐV có ảnh trong sự kiện này.
                  Email sẽ chứa:
                </p>
                <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc">
                  <li>Số lượng ảnh của VĐV</li>
                  <li>Link trực tiếp đến trang sự kiện</li>
                  <li>Hướng dẫn tìm kiếm ảnh</li>
                </ul>
              </div>
            </div>
          </div>

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-900">
                ✅ Đã gửi thành công!
              </p>
              <div className="text-sm text-green-700 mt-2">
                <p>Đã gửi: {result.notified} VĐV</p>
                <p>Tổng số: {result.totalRunners} VĐV có ảnh</p>
                {result.errors.length > 0 && (
                  <p className="text-red-600 mt-2">
                    Lỗi: {result.errors.join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={handleNotify}
            loading={sending}
            disabled={result !== null}
            className="w-full"
          >
            <Mail className="h-5 w-5 mr-2" />
            {sending ? 'Đang gửi...' : 'Gửi thông báo'}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            ⚠️ Lưu ý: Để sử dụng tính năng này, bạn cần thêm trường email vào bảng runners
            và cấu hình email server trong .env
          </p>
        </CardContent>
      </Card>
    </div>
  )
}