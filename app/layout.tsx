import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/providers/session-provider'
import { ToastProvider } from '@/components/providers/toast-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RacePhoto Finder',
  description: 'Tìm kiếm ảnh chạy bộ của bạn',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <head>
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js"
        />
      </head>
      <body className={inter.className}>
        <SessionProvider>
          <ToastProvider />
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}