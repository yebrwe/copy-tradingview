/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'chart-bg': '#131722',
        'chart-grid': '#1e222d',
        'green': '#26a69a',
        'red': '#ef5350',
      },
    },
  },
  plugins: [],
}
