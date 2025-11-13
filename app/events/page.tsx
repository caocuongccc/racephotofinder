import Link from 'next/link'
import prisma from '@/lib/prisma'
import { Navbar } from '@/components/layout/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, MapPin, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

async function getActiveEvents() {
  return await prisma.event.findMany({
    where: {
      isActive: true,
    },
    include: {
      _count: {
        select: {
          photos: true,
          runners: true,
        },
      },
    },
    orderBy: {
      eventDate: 'desc',
    },
  })
}

export default async function EventsPage() {
  const events = await getActiveEvents()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Các giải chạy</h1>
          <p className="text-gray-600 mt-2">
            Tìm kiếm ảnh của bạn trong các giải chạy đã diễn ra
          </p>
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">Chưa có sự kiện nào</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Link key={event.id} href={`/events/${event.slug}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
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

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex space-x-4 text-sm text-gray-600">
                        <span>{event._count.photos} ảnh</span>
                        <span>{event._count.runners} VĐV</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}