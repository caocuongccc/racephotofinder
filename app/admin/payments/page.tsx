'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'

interface Payment {
  id: string
  transactionCode: string
  amount: number
  userEmail: string
  userName?: string
  userPhone?: string
  transferContent?: string
  status: 'pending' | 'verified' | 'rejected' | 'completed' | 'expired'
  createdAt: string
  verifiedAt?: string
  notes?: string
  paymentConfig: {
    event: {
      name: string
    }
  }
  photo: {
    thumbnailUrl?: string
  }
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [notes, setNotes] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all')

  useEffect(() => {
    fetchPayments()
  }, [filter])

  const fetchPayments = async () => {
    try {
      const url = filter === 'all' ? '/api/admin/payments' : `/api/admin/payments?status=${filter}`
      const response = await fetch(url)
      const data = await response.json()
      setPayments(data)
    } catch (error) {
      toast.error('Không thể tải danh sách thanh toán')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (paymentId: string, status: 'verified' | 'rejected') => {
    setVerifying(true)

    try {
      const response = await fetch(`/api/payments/${paymentId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      })

      if (!response.ok) throw new Error('Failed to verify payment')

      toast.success(status === 'verified' ? 'Đã xác nhận thanh toán!' : 'Đã từ chối thanh toán')
      setSelectedPayment(null)
      setNotes('')
      fetchPayments()
    } catch (error) {
      toast.error('Không thể xử lý thanh toán')
    } finally {
      setVerifying(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Chờ xác nhận' },
      verified: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Đã xác nhận' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Từ chối' },
      completed: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'Hoàn thành' },
      expired: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Hết hạn' },
    }
    const badge = badges[status as keyof typeof badges]
    const Icon = badge.icon

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.label}
      </span>
    )
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Quản lý thanh toán</h1>
        <p className="text-gray-600 mt-1">Xác nhận và quản lý thanh toán</p>
      </div>

      {/* Filter */}
      <div className="flex space-x-2">
        {['all', 'pending', 'verified', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Tất cả' : f === 'pending' ? 'Chờ xác nhận' : f === 'verified' ? 'Đã xác nhận' : 'Từ chối'}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Mã GD
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Khách hàng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Số tiền
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sự kiện
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ngày tạo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      Không có thanh toán nào
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono font-medium text-gray-900">
                          {payment.transactionCode}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {payment.userName || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">{payment.userEmail}</div>
                          {payment.userPhone && (
                            <div className="text-sm text-gray-500">{payment.userPhone}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {payment.amount.toLocaleString('vi-VN')} ₫
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {payment.paymentConfig.event.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedPayment(payment)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Detail Modal */}
      {selectedPayment && (
        <Modal
          isOpen={!!selectedPayment}
          onClose={() => setSelectedPayment(null)}
          title="Chi tiết thanh toán"
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Mã giao dịch</label>
                <p className="text-lg font-mono font-semibold">{selectedPayment.transactionCode}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Số tiền</label>
                <p className="text-lg font-semibold text-green-600">
                  {selectedPayment.amount.toLocaleString('vi-VN')} ₫
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Nội dung chuyển khoản</label>
              <p className="text-sm bg-gray-50 p-2 rounded font-mono">
                {selectedPayment.transferContent}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Họ tên</label>
                <p>{selectedPayment.userName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p>{selectedPayment.userEmail}</p>
              </div>
            </div>

            {selectedPayment.status === 'pending' && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Ghi chú (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Ghi chú về thanh toán..."
                  />
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleVerify(selectedPayment.id, 'rejected')}
                    variant="destructive"
                    loading={verifying}
                    className="flex-1"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Từ chối
                  </Button>
                  <Button
                    onClick={() => handleVerify(selectedPayment.id, 'verified')}
                    loading={verifying}
                    className="flex-1"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Xác nhận
                  </Button>
                </div>
              </>
            )}

            {selectedPayment.notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm font-medium text-yellow-900">Ghi chú:</p>
                <p className="text-sm text-yellow-700">{selectedPayment.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}