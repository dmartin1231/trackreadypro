import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#1a1740',
          800: '#26215C',
          700: '#312a72',
          600: '#3d3588',
          500: '#4f44a8',
          400: '#6b60c4',
          300: '#8f86d4',
          200: '#b8b3e4',
          100: '#e0deF4',
          50:  '#f3f2fb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
