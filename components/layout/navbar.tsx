'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Menu } from '@headlessui/react'
import { Camera, User, LogOut, Settings, LayoutDashboard } from 'lucide-react'

export function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Camera className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">RacePhoto</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <Link
                  href="/events"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sự kiện
                </Link>

                {(session.user.role === 'admin' || session.user.role === 'uploader') && (
                  <Link
                    href="/dashboard"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                )}

                <Menu as="div" className="relative">
                  <Menu.Button className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                    <User className="h-5 w-5" />
                    <span>{session.user.name}</span>
                  </Menu.Button>

                  <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none">
                    {session.user.role === 'admin' && (
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            href="/admin"
                            className={`${
                              active ? 'bg-gray-100' : ''
                            } flex items-center px-4 py-2 text-sm text-gray-700`}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Quản trị
                          </Link>
                        )}
                      </Menu.Item>
                    )}

                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard"
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } flex items-center px-4 py-2 text-sm text-gray-700`}
                        >
                          <LayoutDashboard className="h-4 w-4 mr-2" />
                          Dashboard
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => signOut({ callbackUrl: '/' })}
                          className={`${
                            active ? 'bg-gray-100' : ''
                          } flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Đăng xuất
                        </button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Menu>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}