import Link from 'next/link'
import { Camera, Search, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/layout/navbar'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navbar />

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <Camera className="h-20 w-20 text-blue-600" />
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 mb-6">
            Tìm kiếm ảnh chạy bộ của bạn
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Tìm kiếm và tải về những khoảnh khắc đẹp nhất của bạn trong các giải chạy.
            Tìm kiếm bằng số BIB, tên hoặc upload ảnh của bạn.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/events">
              <Button size="lg" className="text-lg px-8 py-6">
                <Search className="mr-2 h-5 w-5" />
                Tìm kiếm ngay
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Đăng nhập
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Tính năng nổi bật
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Search className="h-10 w-10 text-blue-600" />}
              title="Tìm kiếm thông minh"
              description="Tìm kiếm ảnh bằng số BIB, tên hoặc upload ảnh của bạn. Hệ thống AI sẽ tìm những ảnh giống nhất."
            />
            <FeatureCard
              icon={<Download className="h-10 w-10 text-blue-600" />}
              title="Tải về chất lượng cao"
              description="Tải về ảnh gốc chất lượng cao, không watermark. Hoàn toàn miễn phí."
            />
            <FeatureCard
              icon={<Upload className="h-10 w-10 text-blue-600" />}
              title="Quản lý dễ dàng"
              description="Photographer có thể upload và quản lý ảnh dễ dàng. Phân quyền linh hoạt cho từng sự kiện."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Sẵn sàng tìm ảnh của bạn?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Hàng ngàn vận động viên đã tìm thấy ảnh của họ
          </p>
          <Link href="/events">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
              Khám phá các giải chạy
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
          <p>&copy; 2024 RacePhoto Finder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="text-center p-6">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}