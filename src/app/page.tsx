'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SourceCard } from '@/components/SourceCard'
import { SourceType } from '@/types/database'

interface SourceData {
  id: string
  name: string
  slug: string
  type: SourceType
  description: string | null
  audience: string | null
  reach: string | null
}

interface SourcesResponse {
  newsletters: SourceData[]
  blogs: SourceData[]
}

export default function Home() {
  const [sources, setSources] = useState<SourcesResponse>({ newsletters: [], blogs: [] })
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSources() {
      try {
        const response = await fetch('/api/sources')
        if (!response.ok) {
          throw new Error('Failed to fetch sources')
        }
        const data: SourcesResponse = await response.json()
        setSources(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sources')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSources()
  }, [])

  const handleToggleSource = (sourceId: string) => {
    setSelectedSourceIds(prev => {
      const next = new Set(prev)
      if (next.has(sourceId)) {
        next.delete(sourceId)
      } else {
        next.add(sourceId)
      }
      return next
    })
  }

  const allSourceIds = [...sources.newsletters, ...sources.blogs].map(s => s.id)
  const allSelected = allSourceIds.length > 0 && allSourceIds.every(id => selectedSourceIds.has(id))

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedSourceIds(new Set())
    } else {
      setSelectedSourceIds(new Set(allSourceIds))
    }
  }

  // Convert SourceData to Source-compatible shape for SourceCard
  const toSource = (s: SourceData) => ({
    ...s,
    feed_url: null,
    intake_email: null,
    icon_url: null,
    is_active: true,
    created_at: '',
    updated_at: '',
  })

  if (isLoading) {
    return (
      <main className="min-h-screen bg-cream">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Header />
          <div className="mt-12 text-center text-warm-gray">
            Loading sources...
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-cream">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Header />
          <div className="mt-12 text-center text-error-rose">
            {error}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Header />

        <div className="mt-12 space-y-8">
          {/* Newsletters Section */}
          {sources.newsletters.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-charcoal mb-4">
                Newsletters
              </h2>
              <div className="grid gap-3">
                {sources.newsletters.map(source => (
                  <SourceCard
                    key={source.id}
                    source={toSource(source)}
                    selected={selectedSourceIds.has(source.id)}
                    onToggle={handleToggleSource}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Blogs Section */}
          {sources.blogs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-charcoal mb-4">
                Blogs
              </h2>
              <div className="grid gap-3">
                {sources.blogs.map(source => (
                  <SourceCard
                    key={source.id}
                    source={toSource(source)}
                    selected={selectedSourceIds.has(source.id)}
                    onToggle={handleToggleSource}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Select All Button */}
          {allSourceIds.length > 0 && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-lavender hover:text-lavender-hover font-medium transition-colors"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-12">
          <Footer />
        </div>
      </div>
    </main>
  )
}
