/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#F0FDFA', // Mint White
          dark: '#111827',
        },
        brand: {
          500: '#0F766E', // Trust Teal
          600: '#14B8A6', // Vibrant Teal
        },
        cta: '#0369A1', // Professional Blue
        textMain: '#134E4A', // Dark Emerald
        success: '#10B981',
        warning: '#F59E0B',
        critical: '#EF4444',
      },
      fontFamily: {
        sans: ['JosefinSans_400Regular', 'sans-serif'],
        cinzel: ['Cinzel_700Bold', 'serif'],
      },
    },
  },
  plugins: [],
}

