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
        'background-dark': '#101922',
        'results-background-dark': '#09090b',
        'card-dark': '#192633',
        'border-dark': '#233648',
        'muted-foreground': '#92adc9',
        'surface-dark': '#18181b',
        'surface-highlight': '#27272a',
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
