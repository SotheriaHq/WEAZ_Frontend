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
    
    },
  },
  plugins: [],
}

