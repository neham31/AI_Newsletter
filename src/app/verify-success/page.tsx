import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import Link from 'next/link'

export default function VerifySuccessPage() {
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
              You&apos;re all set!
            </h2>

            {/* Message about first digest */}
            <p className="text-warm-gray mb-6">
              Your email has been verified. Your first AI digest will arrive based on your selected frequency - daily subscribers receive their digest every morning, weekly subscribers receive theirs every Monday.
            </p>

            {/* Link to manage preferences */}
            <p className="text-sm text-light-gray">
              Want to change your sources or frequency?{' '}
              <Link
                href="/preferences"
                className="text-lavender hover:text-lavender-hover font-medium transition-colors"
              >
                Manage your preferences
              </Link>{' '}
              using the link in any digest email.
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
