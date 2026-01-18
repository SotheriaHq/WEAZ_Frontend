/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [

    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",

  ],
  theme: {
    extend: {
      colors: {
        dark: '#000000',
        'light-gray': '#f0f2f5',
        primary: '#9333EA',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
}

