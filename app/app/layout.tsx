import type { Metadata } from 'next'
import Link from 'next/link'

import { Toaster } from '@/components/ui/sonner'

import { NotificationsListener } from './notifications-listener'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Time Off',
  description: 'ExampleHR time-off frontend',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>
          <header className="flex items-center gap-4 border-b px-4 py-2 text-sm">
            <span className="font-medium">Time Off</span>
            <nav className="flex gap-3">
              <Link href="/employee">Employee</Link>
              <Link href="/manager">Manager</Link>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
          <NotificationsListener />
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
