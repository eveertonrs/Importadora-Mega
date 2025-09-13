module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'mega-blue': '#007bff',
        'mega-green': '#28a745',
        'mega-red': '#dc3545',
        'mega-yellow': '#ffc107',
        'mega-gray': '#6c757d',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
