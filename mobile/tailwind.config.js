/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        pageBg: '#F7F5F2', // warm-bg
        card: '#FFFFFF',
        navy: {
          DEFAULT: '#1F2F3A',
          muted: '#333333',
          border: '#D8D2C8', // neutral
          bg: 'rgba(31, 47, 58, 0.08)'
        },
        burgundy: {
          DEFAULT: '#8B2030',
          bg: 'rgba(139,32,48,0.08)',
        },
        neutral: {
          DEFAULT: '#D8D2C8',
        }
      },
      fontFamily: {
        sans: ['DMSans_400Regular', 'sans-serif'],
        sansBold: ['DMSans_700Bold', 'sans-serif'],
        cormorant: ['Cormorant_300Light', 'serif'],
        cormorantRegular: ['Cormorant_400Regular', 'serif'],
      },
    },
  },
  plugins: [],
}

