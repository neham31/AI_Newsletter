import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'

export default function UnsubscribedPage() {
  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Header />

        <div className="mt-12 flex flex-col items-center">
          <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md text-center">
            {/* Gray/Muted Icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-light-gray flex items-center justify-center mb-6">
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
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>

            {/* Heading */}
            <h1 className="text-2xl font-bold text-charcoal mb-3">
              You&apos;ve been unsubscribed.
            </h1>

            {/* Message */}
            <p className="text-warm-gray mb-6">
              You won&apos;t receive any more emails from explAI.in.
              We&apos;re sorry to see you go!
            </p>

            {/* Re-subscribe Link */}
            <a
              href="/"
              className="inline-block text-lavender hover:text-lavender-hover font-medium transition-colors"
            >
              Changed your mind? Subscribe again
            </a>
          </div>
        </div>

        <div className="mt-12">
          <Footer />
        </div>
      </div>
    </main>
  )
}
