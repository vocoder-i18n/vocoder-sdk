import './globals.css'

import { Inter } from 'next/font/google'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vocoder SDK Development Environment',
  description: 'Test environment for Vocoder React SDK',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Test meta tag approach */}
        <meta name="VOCODER_API_KEY" content="test-meta-key" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
} 