'use client'

import { InputHTMLAttributes, forwardRef } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, className = '', ...props }, ref) => {
    const baseStyles = 'w-full rounded-lg px-4 py-3 bg-white text-charcoal placeholder-light-gray border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'

    const stateStyles = error
      ? 'border-error-rose focus:border-error-rose focus:ring-error-rose'
      : 'border-border-gray focus:border-lavender focus:ring-lavender'

    return (
      <input
        ref={ref}
        className={`${baseStyles} ${stateStyles} ${className}`}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
