/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		colors: {
  			// Custom theme colors using CSS variables
  			bg: {
  				0: 'var(--bg-0)',
  				000: 'var(--bg-000)',
  				100: 'var(--bg-100)',
  				200: 'var(--bg-200)',
  				300: 'var(--bg-300)',
  			},
  			text: {
  				100: 'var(--text-100)',
  				200: 'var(--text-200)',
  				300: 'var(--text-300)',
  				400: 'var(--text-400)',
  				500: 'var(--text-500)',
  			},
  			accent: {
  				DEFAULT: 'var(--accent)',
  				hover: 'var(--accent-hover)',
  			},
  			// Standard colors for shadcn/ui components
  			background: 'var(--color-background)',
  			foreground: 'var(--color-foreground)',
  			card: {
  				DEFAULT: 'var(--color-card)',
  				foreground: 'var(--color-card-foreground)'
  			},
  			popover: {
  				DEFAULT: 'var(--color-popover)',
  				foreground: 'var(--color-popover-foreground)'
  			},
  			primary: {
  				DEFAULT: 'var(--color-primary)',
  				foreground: 'var(--color-primary-foreground)'
  			},
  			secondary: {
  				DEFAULT: 'var(--color-secondary)',
  				foreground: 'var(--color-secondary-foreground)'
  			},
  			muted: {
  				DEFAULT: 'var(--color-muted)',
  				foreground: 'var(--color-muted-foreground)'
  			},
  			destructive: {
  				DEFAULT: 'var(--color-destructive)',
  			},
  			border: 'var(--color-border)',
  			input: 'var(--color-input)',
  			ring: 'var(--color-ring)',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
