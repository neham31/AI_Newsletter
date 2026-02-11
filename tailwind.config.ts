import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FAFAF7',
        lavender: '#B8A9E8',
        'lavender-hover': '#9B87D6',
        mint: '#A8D8C8',
        peach: '#F5C5A3',
        charcoal: '#2D2D2D',
        'warm-gray': '#6B6B6B',
        'light-gray': '#9B9B9B',
        'border-gray': '#E8E8E4',
        'error-rose': '#E8A0A0',
        'success-green': '#A0D8B8',
      },
    },
  },
  plugins: [],
}
export default config
