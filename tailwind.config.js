/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0f0f17',
          800: '#16161f',
          700: '#1e1e2a',
          600: '#252534',
          500: '#2e2e3d',
          400: '#3a3a4d',
        },
        accent: {
          DEFAULT: '#8b5cf6',
          hover: '#7c3aed',
          muted: '#6d28d9',
          glow: 'rgba(139,92,246,0.3)',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#e2e8f0',
          },
        },
      },
    },
  },
  plugins: [],
}
