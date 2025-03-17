/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./bot_frontend/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    'animate-matrix-fall',  // Ensures the animation class is always included
  ],
  theme: {
    extend: {
      colors: {
        'neon-yellow': '#ffea00',
        'neon-green': '#00ff9f',
        'neon-blue': '#00ddeb',
        'neon-purple': '#d900ff',
        'neon-red': '#ff004d',
        'cyber-pink': '#ff007a',
        'cyber-cyan': '#00e5ff',
        'cyber-purple': '#7a00ff',
        'retro-orange': '#ff8c00',
        'retro-green': '#008000',
        'retro-blue': '#0000ff',
        'pastel-purple': '#9b59b6',
        'pastel-teal': '#00cec9',
        'pastel-pink': '#ff85a2',
        'pastel-blue': '#74b9ff',
        'matrix-green': '#00ff00', // Bright green for that Matrix glow
        'matrix-dark': '#0a0f0a', // Darker green-black background
        'matrix-shadow': '#1a2b1a', // Subtle green tint for depth
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
      // Add your custom animation
      animation: {
        'matrix-fall': 'matrix-fall 1.5s ease-in-out infinite',
      },
      // Define the keyframes for the animation
      keyframes: {
        'matrix-fall': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};