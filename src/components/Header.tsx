'use client'

export function Header() {
  return (
    <header className="text-center">
      <h1 className="text-3xl md:text-4xl font-bold text-charcoal mb-3">
        AI Digest
      </h1>
      <p className="text-lg md:text-xl text-warm-gray mb-2">
        Your AI news, curated &amp; deduplicated.
      </p>
      <p className="text-base text-light-gray">
        Pick your sources. Choose your frequency. That&apos;s it.
      </p>
    </header>
  )
}
