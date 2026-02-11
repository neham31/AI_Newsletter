'use client'

import { Source } from '@/types/database'

export interface SourceCardProps {
  source: Source
  selected: boolean
  onToggle: (sourceId: string) => void
}

export function SourceCard({ source, selected, onToggle }: SourceCardProps) {
  const handleClick = () => {
    onToggle(source.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle(source.id)
    }
  }

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        relative cursor-pointer rounded-lg border bg-white p-4 transition-all
        ${selected
          ? 'border-l-[3px] border-l-lavender border-t-border-gray border-r-border-gray border-b-border-gray bg-lavender/[0.08]'
          : 'border-border-gray hover:shadow-md'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-0.5">
          <div
            className={`
              h-5 w-5 rounded border-2 flex items-center justify-center transition-colors
              ${selected
                ? 'border-lavender bg-lavender'
                : 'border-border-gray bg-white'
              }
            `}
          >
            {selected && (
              <svg
                className="h-3 w-3 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-charcoal">{source.name}</h3>
          {source.description && (
            <p className="mt-1 text-sm text-warm-gray line-clamp-2">
              {source.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-light-gray">
            {source.audience && (
              <span className="inline-flex items-center">
                <span className="font-medium">Audience:</span>
                <span className="ml-1">{source.audience}</span>
              </span>
            )}
            {source.reach && (
              <span className="inline-flex items-center">
                <span className="font-medium">Reach:</span>
                <span className="ml-1">{source.reach}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
