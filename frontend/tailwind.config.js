/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ide-bg': 'var(--ide-bg)',
        'ide-panel': 'var(--ide-panel)',
        'ide-border': 'var(--ide-border)',
        'ide-text': 'var(--ide-text)',
        'ide-text-muted': 'var(--ide-text-muted)',
        'ide-accent': 'var(--ide-accent)',
        'ide-accent-hover': 'var(--ide-accent-hover)',
      },
    },
  },
  plugins: [],
}
