/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // h-8.5 / w-6.5 / h-7.5 are used across LeftDock, RightPanel and
      // CustomCursor, but 8.5, 7.5 and 6.5 are NOT in Tailwind's default
      // spacing scale (which stops at .5 increments after 3.5). Those classes
      // were silently never generated, so the elements collapsed to their
      // content — the dock tab buttons were 17x17 hit targets instead of the
      // intended 34x34. Defining them here makes the original intent work.
      spacing: {
        '6.5': '1.625rem', // 26px
        '7.5': '1.875rem', // 30px
        '8.5': '2.125rem', // 34px
      },
      colors: {
        ink: {
          950: '#08090d',
          900: '#0c0e13',
          850: '#111420',
          800: '#161a23',
          750: '#1b2030',
          700: '#232a39',
          600: '#2e374a',
          // 300-500 are the TEXT ramp. The previous values (400 #55617a and
          // 500 #3c475d) measured 2.8-3.2:1 and 1.9-2.1:1 against the dark
          // surfaces, well under the WCAG AA 4.5:1 minimum for normal text,
          // so nearly every secondary label in the app was unreadable to
          // anyone with low contrast sensitivity. These keep the same hue and
          // the same relative ordering, but all clear 4.5:1 on every surface
          // from ink-950 through ink-800 (4.57 / 6.67 / 9.59 at worst).
          500: '#77839c',
          400: '#94a1b8',
          300: '#b6c1d4',
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
