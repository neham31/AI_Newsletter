'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SourceCard } from '@/components/SourceCard'
import { FrequencySelector } from '@/components/FrequencySelector'
import { Input } from '@/components/ui/Input'
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

interface ValidationError {
  field: string
  message: string
}

interface SubscribeResponse {
  success?: boolean
  errors?: ValidationError[]
  waitlisted?: boolean
  position?: number
  message?: string
  error?: string
}

export default function Home() {
  const [sources, setSources] = useState<SourcesResponse>({ newsletters: [], blogs: [] })
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set())
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string>('')

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

  // Get selected source slugs for form submission
  const getSelectedSlugs = (): string[] => {
    const allSources = [...sources.newsletters, ...sources.blogs]
    return allSources
      .filter(s => selectedSourceIds.has(s.id))
      .map(s => s.slug)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous errors and messages
    setFieldErrors({})
    setSubmitMessage(null)
    setSubmitSuccess(false)

    // Client-side validation
    const errors: Record<string, string> = {}

    if (selectedSourceIds.size === 0) {
      errors.sources = 'Please select at least one source.'
    }

    const emailTrimmed = email.trim()
    if (!emailTrimmed) {
      errors.email = 'Please enter a valid email address.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.email = 'Please enter a valid email address.'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    // Submit to API
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailTrimmed,
          sources: getSelectedSlugs(),
          frequency,
        }),
      })

      const data: SubscribeResponse = await response.json()

      if (!response.ok) {
        // Handle validation errors from server
        if (data.errors) {
          const serverErrors: Record<string, string> = {}
          for (const err of data.errors) {
            serverErrors[err.field] = err.message
          }
          setFieldErrors(serverErrors)
        } else if (data.error) {
          setSubmitMessage(data.error)
        }
        return
      }

      // Handle success or other responses
      if (data.success === true) {
        setSubmittedEmail(emailTrimmed)
        setSubmitSuccess(true)
        setSubmitMessage(data.message || 'Check your email to confirm your subscription!')
      } else if (data.waitlisted) {
        setSubmitMessage(data.message || `You've been added to the waitlist! Position: ${data.position}`)
      } else if (data.message) {
        // Handle cases like "email already subscribed"
        setSubmitMessage(data.message)
      }
    } catch (err) {
      console.error('Error submitting form:', err)
      setSubmitMessage('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

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

  // Success State - Show confirmation card
  if (submitSuccess) {
    return (
      <main className="min-h-screen bg-cream">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Header />

          <div className="mt-12 flex flex-col items-center">
            <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md text-center">
              {/* Mint Green Checkmark Icon */}
              <div className="mx-auto w-16 h-16 rounded-full bg-mint flex items-center justify-center mb-6">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              {/* Heading */}
              <h2 className="text-2xl font-bold text-charcoal mb-3">
                Check your inbox!
              </h2>

              {/* Message with user's email */}
              <p className="text-warm-gray">
                We&apos;ve sent a confirmation email to{' '}
                <span className="font-semibold text-charcoal">{submittedEmail}</span>.
                Click the link in the email to start receiving your personalized AI digest.
              </p>
            </div>
          </div>

          <div className="mt-12">
            <Footer />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Header />

        <form onSubmit={handleSubmit} className="mt-12 space-y-8">
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

          {/* Source Selection Error */}
          {fieldErrors.sources && (
            <p className="text-error-rose text-sm text-center">
              {fieldErrors.sources}
            </p>
          )}

          {/* Frequency Selection Section */}
          <section className="pt-4">
            <h2 className="text-lg font-semibold text-charcoal mb-4">
              Delivery Frequency
            </h2>
            <FrequencySelector value={frequency} onChange={setFrequency} />
          </section>

          {/* Email Subscription Section */}
          <section className="pt-4">
            <h2 className="text-lg font-semibold text-charcoal mb-4">
              Subscribe
            </h2>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={!!fieldErrors.email}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-error-rose text-sm">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting}>
                Subscribe
              </Button>
            </div>
            <p className="mt-3 text-sm text-warm-gray">
              We&apos;ll send a confirmation email. No spam, ever.
            </p>
            {submitMessage && !submitSuccess && (
              <p className="mt-3 text-sm text-warm-gray">
                {submitMessage}
              </p>
            )}
          </section>
        </form>

        <div className="mt-12">
          <Footer />
        </div>
      </div>
    </main>
  )
}
