'use client'

import Image from 'next/image'
import Link from 'next/link'

export function Header() {
  return (
    <header className="text-center">
      <Link href="/" className="inline-block mb-3">
        <Image
          src="/logo.png"
          alt="explAI.in"
          width={200}
          height={50}
          className="h-10 md:h-12 w-auto"
          priority
        />
      </Link>
      <p className="text-lg md:text-xl text-warm-gray mb-2">
        Your AI news, curated &amp; deduplicated.
      </p>
      <p className="text-base text-light-gray">
        Pick your sources. Choose your frequency. That&apos;s it.
      </p>
    </header>
  )
}
