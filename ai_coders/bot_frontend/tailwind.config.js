/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./bot_frontend/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    'animate-matrix-fall',  // Matrix falling effect
    'animate-matrix-glitch', // Matrix glitch effect
    'animate-glow',         // Cyberpunk glow effect
    'animate-bounce',       // Pastel bounce effect
  ],
  theme: {
    extend: {
      colors: {
        // Neon Theme (unchanged)
        'neon-yellow': '#ffea00',
        'neon-green': '#00ff9f',
        'neon-blue': '#00ddeb',
        'neon-purple': '#d900ff',
        'neon-red': '#ff004d',
        // Cyberpunk Theme
        'cyber-dark': '#0a0a14',    // Dark background
        'cyber-bg': '#1a1a2e',      // Chat background
        'cyber-pink': '#ff007a',
        'cyber-cyan': '#00e5ff',
        'cyber-purple': '#7a00ff',
        'cyber-blue': '#00b7eb',    // Hover state
        // Retro Theme
        'retro-orange': '#ff8c00',
        'retro-green': '#008000',
        'retro-blue': '#0000ff',
        'retro-dark': '#8b5a2b',   // Chat background (brown)
        // Pastel Theme
        'pastel-purple': '#9b59b6',
        'pastel-teal': '#00cec9',
        'pastel-pink': '#ff85a2',
        'pastel-blue': '#74b9ff',
        'pastel-dark': '#4a2c3d',  // Text color
        'pastel-bg': '#fce4ec',    // Background
        'pastel-light': '#f8bbd0', // Chat background
        // Matrix Theme
        'matrix-green': '#00ff00',  // Bright green for glow
        'matrix-dark': '#0a0f0a',   // Darker green-black background
        'matrix-shadow': '#1a2b1a', // Subtle green tint
        'matrix-bg': '#1a251a',     // Chat background
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
      boxShadow: {
        'cyber': '0 0 10px #00e5ff',         // Cyberpunk glow
        'retro': 'inset 0 0 5px #ff8c00',    // Retro inset shadow
        'pastel': '0 0 8px #ff85a2',         // Pastel soft shadow
        'matrix-glow': '0 0 10px #00ff00, 0 0 20px #00ff00', // Matrix neon glow
        'glow': '0 0 15px currentColor',     // Generic glow for Cyberpunk
      },
      animation: {
        'matrix-fall': 'matrix-fall 1.5s ease-in-out infinite',
        'matrix-glitch': 'matrix-glitch 0.3s ease-in-out infinite',
        'glow': 'glow 1.5s ease-in-out infinite',
        'bounce': 'bounce 1s ease-in-out infinite',
      },
      keyframes: {
        'matrix-fall': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(0)', opacity: '0.7' },
        },
        'matrix-glitch': {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(2px, -2px)' },
          '60%': { transform: 'translate(-1px, 1px)' },
          '80%': { transform: 'translate(1px, -1px)' },
          '100%': { transform: 'translate(0)' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 5px currentColor' },
          '50%': { boxShadow: '0 0 15px currentColor' },
          '100%': { boxShadow: '0 0 5px currentColor' },
        },
        'bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
};