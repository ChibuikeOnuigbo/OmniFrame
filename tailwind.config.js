/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090d',
          900: '#0c0e13',
          850: '#111420',
          800: '#161a23',
          750: '#1b2030',
          700: '#232a39',
          600: '#2e374a',
          500: '#3c475d',
          400: '#55617a',
        },
        brand: {
          DEFAULT: '#6d5efc',
          600: '#5a4be0',
          500: '#6d5efc',
          400: '#9083ff',
        },
        accent: '#22d3ee',
        ok: '#34d399',
        warn: '#fbbf24',
        bad: '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
