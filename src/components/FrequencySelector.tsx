'use client'

import { Frequency } from '@/types/database'

export interface FrequencySelectorProps {
  value: Frequency
  onChange: (frequency: Frequency) => void
}

const frequencyOptions: { value: Frequency; label: string; description: string }[] = [
  {
    value: 'daily',
    label: 'Daily',
    description: 'Get your digest every morning at 8 AM IST',
  },
  {
    value: 'weekly',
    label: 'Weekly',
    description: 'Get your digest every Monday at 8 AM IST',
  },
]

export function FrequencySelector({ value, onChange }: FrequencySelectorProps) {
  const selectedOption = frequencyOptions.find((opt) => opt.value === value)

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="radiogroup" aria-label="Email frequency">
        {frequencyOptions.map((option) => {
          const isSelected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={`
                rounded-full px-6 py-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lavender
                ${isSelected
                  ? 'bg-lavender text-white'
                  : 'bg-white text-charcoal border border-border-gray hover:bg-gray-50'
                }
              `}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {selectedOption && (
        <p className="text-sm text-warm-gray">{selectedOption.description}</p>
      )}
    </div>
  )
}
