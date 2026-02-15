'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SourceCard } from '@/components/SourceCard'
import { FrequencySelector } from '@/components/FrequencySelector'
import { Button } from '@/components/ui/Button'
import { SourceType, Frequency } from '@/types/database'

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

interface PreferencesResponse {
  frequency: Frequency
  sources: SourceData[]
}

function PreferencesContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [allSources, setAllSources] = useState<SourcesResponse>({ newsletters: [], blogs: [] })
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set())
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    async function fetchData() {
      if (!token) {
        setError('No token provided. Please use the link from your email.')
        setIsLoading(false)
        return
      }

      try {
        // Fetch all available sources and user preferences in parallel
        const [sourcesResponse, preferencesResponse] = await Promise.all([
          fetch('/api/sources'),
          fetch(`/api/preferences?token=${encodeURIComponent(token)}`),
        ])

        if (!sourcesResponse.ok) {
          throw new Error('Failed to fetch sources')
        }

        const sourcesData: SourcesResponse = await sourcesResponse.json()
        setAllSources(sourcesData)

        if (!preferencesResponse.ok) {
          const prefError = await preferencesResponse.json()
          if (preferencesResponse.status === 404) {
            throw new Error('Invalid token. Please use a valid link from your email.')
          }
          throw new Error(prefError.error || 'Failed to fetch preferences')
        }

        const preferencesData: PreferencesResponse = await preferencesResponse.json()

        // Set user's frequency
        setFrequency(preferencesData.frequency)

        // Set selected source IDs from user's current subscriptions
        const userSourceIds = new Set(preferencesData.sources.map(s => s.id))
        setSelectedSourceIds(userSourceIds)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [token])

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

  const allSourceIds = [...allSources.newsletters, ...allSources.blogs].map(s => s.id)
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

  // Get selected source slugs for form submission
  const getSelectedSlugs = (): string[] => {
    const sources = [...allSources.newsletters, ...allSources.blogs]
    return sources
      .filter(s => selectedSourceIds.has(s.id))
      .map(s => s.slug)
  }

  const handleSave = async () => {
    if (!token) return

    // Validate at least one source selected
    if (selectedSourceIds.size === 0) {
      setSaveMessage('Please select at least one source.')
      setSaveSuccess(false)
      return
    }

    setSaveMessage(null)
    setSaveSuccess(false)
    setIsSaving(true)

    try {
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          frequency,
          sources: getSelectedSlugs(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save preferences')
      }

      setSaveMessage('Preferences updated successfully!')
      setSaveSuccess(true)
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save preferences')
      setSaveSuccess(false)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-cream">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Header />
          <div className="mt-12 text-center text-warm-gray">
            Loading preferences...
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

        <div className="mt-8 mb-6">
          <h1 className="text-2xl font-bold text-charcoal">Manage Preferences</h1>
          <p className="mt-2 text-warm-gray">
            Update your source selections and delivery frequency.
          </p>
        </div>

        <div className="space-y-8">
          {/* Newsletters Section */}
          {allSources.newsletters.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-charcoal mb-4">
                Newsletters
              </h2>
              <div className="grid gap-3">
                {allSources.newsletters.map(source => (
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
          {allSources.blogs.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-charcoal mb-4">
                Blogs
              </h2>
              <div className="grid gap-3">
                {allSources.blogs.map(source => (
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

          {/* Frequency Selection Section */}
          <section className="pt-4">
            <h2 className="text-xl font-semibold text-charcoal mb-4">
              Delivery Frequency
            </h2>
            <FrequencySelector value={frequency} onChange={setFrequency} />
          </section>

          {/* Save Button Section */}
          <section className="pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              isLoading={isSaving}
            >
              Save Changes
            </Button>
            {saveMessage && (
              <p className={`mt-3 text-sm ${saveSuccess ? 'text-success-green' : 'text-error-rose'}`}>
                {saveMessage}
              </p>
            )}
          </section>

          {/* Unsubscribe Link */}
          <section className="pt-8 border-t border-border-gray">
            <p className="text-sm text-warm-gray">
              Want to stop receiving emails?{' '}
              <a
                href={`/api/unsubscribe?token=${encodeURIComponent(token || '')}`}
                className="text-lavender hover:text-lavender-hover underline"
              >
                Unsubscribe
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12">
          <Footer />
        </div>
      </div>
    </main>
  )
}

export default function PreferencesPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-cream">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Header />
          <div className="mt-12 text-center text-warm-gray">
            Loading preferences...
          </div>
        </div>
      </main>
    }>
      <PreferencesContent />
    </Suspense>
  )
}
