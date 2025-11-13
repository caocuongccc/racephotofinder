import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Image, Users, Upload } from 'lucide-react'

async function getDashboardStats(userId: string, role: string) {
  if (role === 'admin') {
    const [eventsCount, photosCount, usersCount] = await Promise.all([
      prisma.event.count(),
      prisma.photo.count(),
      prisma.user.count(),
    ])

    return {
      events: eventsCount,
      photos: photosCount,
      users: usersCount,
    }
  } else if (role === 'uploader') {
    const [eventsCount, photosCount] = await Promise.all([
      prisma.eventPermission.count({
        where: { uploaderId: userId },
      }),
      prisma.photo.count({
        where: { uploadedBy: userId },
      }),
    ])

    return {
      events: eventsCount,
      photos: photosCount,
      users: 0,
    }
  }

  return {
    events: 0,
    photos: 0,
    users: 0,
  }
}

async function getRecentActivities(userId: string, role: string) {
  const where = role === 'admin' ? {} : { uploadedBy: userId }

  const recentPhotos = await prisma.photo.findMany({
    where,
    include: {
      event: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      uploadDate: 'desc',
    },
    take: 5,
  })

  return recentPhotos
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return null
  }

  const stats = await getDashboardStats(session.user.id, session.user.role)
  const recentActivities = await getRecentActivities(session.user.id, session.user.role)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Chào mừng trở lại, {session.user.name}!</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Sự kiện"
          value={stats.events}
          icon={<Calendar className="h-8 w-8 text-blue-600" />}
          description="Tổng số sự kiện"
        />
        <StatCard
          title="Ảnh"
          value={stats.photos}
          icon={<Image className="h-8 w-8 text-green-600" />}
          description="Tổng số ảnh đã upload"
        />
        {session.user.role === 'admin' && (
          <StatCard
            title="Người dùng"
            value={stats.users}
            icon={<Users className="h-8 w-8 text-purple-600" />}
            description="Tổng số người dùng"
          />
        )}
      </div>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Chưa có hoạt động nào</p>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((photo) => (
                <div key={photo.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <Upload className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Đã upload ảnh vào sự kiện {photo.event.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(photo.uploadDate).toLocaleDateString('vi-VN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Thao tác nhanh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(session.user.role === 'admin' || session.user.role === 'uploader') && (
              <>
                <QuickActionButton
                  href="/dashboard/events/new"
                  icon={<Calendar className="h-6 w-6" />}
                  title="Tạo sự kiện mới"
                />
                <QuickActionButton
                  href="/dashboard/upload"
                  icon={<Upload className="h-6 w-6" />}
                  title="Upload ảnh"
                />
              </>
            )}
            {session.user.role === 'admin' && (
              <QuickActionButton
                href="/admin/users/new"
                icon={<Users className="h-6 w-6" />}
                title="Thêm người dùng"
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string
  value: number
  icon: React.ReactNode
  description: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </div>
          <div>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickActionButton({
  href,
  icon,
  title,
}: {
  href: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <a
      href={href}
      className="flex items-center space-x-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="text-blue-600">{icon}</div>
      <span className="text-sm font-medium text-gray-900">{title}</span>
    </a>
  )
}