import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'explAI.in - AI News Digest',
  description: 'Your personalized AI news digest. Get the latest AI developments from top newsletters and blogs, curated and deduplicated.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.ico',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'explAI.in - AI News Digest',
    description: 'Your personalized AI news digest. Get the latest AI developments from top newsletters and blogs, curated and deduplicated.',
    images: ['/logo.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'explAI.in - AI News Digest',
    description: 'Your personalized AI news digest. Get the latest AI developments from top newsletters and blogs.',
    images: ['/logo.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
