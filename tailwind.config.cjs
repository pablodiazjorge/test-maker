/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#137fec',
        'primary-foreground': '#ffffff',
        'background-light': '#f6f7f8',
        'background-dark': '#0f172a',
        'card-dark': '#1e293b',
        'border-dark': '#475569',
        'muted-foreground': '#94a3b8',
        'surface-dark': '#1e293b',
        'surface-highlight': '#334155',
        success: '#10b981',
        error: '#ef4444',
      },
      fontFamily: {
        display: ['Lexend', 'sans-serif'],
        sans: ['Lexend', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
