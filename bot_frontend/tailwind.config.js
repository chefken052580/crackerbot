module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./bot_frontend/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "neon-green": "#39ff14",
        "neon-yellow": "#f5f50a", // Updated to match index.css
        "neon-blue": "#00ffff",
        "gray-900": "#1a1a1a",
        "gray-800": "#333333",
        "gray-700": "#4d4d4d",
      },
      fontSize: {
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },
      fontWeight: {
        'bold': '700',
        'semibold': '600',
      },
      padding: {
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '6': '1.5rem',
      },
      margin: {
        '3': '0.75rem',
        '4': '1rem',
      },
      spacing: {
        '4': '1rem',
      },
    },
  },
  plugins: [],
};