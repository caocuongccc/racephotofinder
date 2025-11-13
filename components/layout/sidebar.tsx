'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  Calendar,
  Upload,
  Users,
  Image,
  Settings,
  UserCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
  roles: string[]
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['admin', 'uploader', 'user'],
  },
  {
    title: 'Sự kiện',
    href: '/dashboard/events',
    icon: <Calendar className="h-5 w-5" />,
    roles: ['admin', 'uploader'],
  },
  {
    title: 'Upload ảnh',
    href: '/dashboard/upload',
    icon: <Upload className="h-5 w-5" />,
    roles: ['admin', 'uploader'],
  },
  {
    title: 'Quản lý ảnh',
    href: '/dashboard/photos',
    icon: <Image className="h-5 w-5" />,
    roles: ['admin', 'uploader'],
  },
  {
    title: 'Người dùng',
    href: '/admin/users',
    icon: <Users className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    title: 'Phân quyền',
    href: '/admin/permissions',
    icon: <UserCog className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    title: 'Cài đặt',
    href: '/dashboard/settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['admin', 'uploader', 'user'],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(session?.user?.role || 'user')
  )

  return (
    <div className="flex flex-col w-64 bg-gray-900 min-h-screen">
      <div className="flex items-center justify-center h-16 border-b border-gray-800">
        <span className="text-white text-xl font-bold">RacePhoto</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              {item.icon}
              <span className="ml-3">{item.title}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
              {session?.user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{session?.user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  )
}