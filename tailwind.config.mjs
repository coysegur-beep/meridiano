/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0A0A0A', soft: '#2A2A28' },
        paper: { DEFAULT: '#F5F1E8', light: '#FAF7F0', dark: '#E8E2D4' },
        rule: '#CFC8B6',
        red: { DEFAULT: '#C8102E', dark: '#9C0B22' },
        gold: '#B8934F',
        up: '#0A7D3B',
        down: '#C8102E',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        serif: ['"Source Serif 4"', '"Source Serif Pro"', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: { container: '1440px' },
    },
  },
  plugins: [],
};
