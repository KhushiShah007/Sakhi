/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        peach: '#FEA38E',
        'peach-light': '#FFDFC3',
        blush: '#FBA2AB',
        ivory: '#FBEBDD',
        terracotta: '#F3B5A0',
        rose: { DEFAULT: '#D6336C', pressed: '#B02458' },
        peri: { DEFAULT: '#6C7BD9', deep: '#5361C8' },
        lavender: '#E6D6F5',
        lilac: '#F3E8FB',
        ink: { DEFAULT: '#3B1F2B', soft: '#6B4A57' },
        plum: { night: '#1A0E15', dim: '#2A1722' },
        butter: '#FFD58A',
      },
      fontFamily: {
        sans: ['Poppins', '"Noto Sans Devanagari"', '"Noto Sans Gujarati"', 'system-ui', 'sans-serif'],
        hand: ['Kalam', '"Noto Sans Devanagari"', '"Noto Sans Gujarati"', 'cursive'],
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(176, 36, 88, 0.25)',
        card: '0 6px 24px -10px rgba(120, 50, 60, 0.22)',
        glow: '0 0 40px 10px rgba(251, 162, 171, 0.55)',
        phone: '0 40px 80px -20px rgba(120, 40, 70, 0.45), 0 0 0 1px rgba(255,255,255,0.4) inset',
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.5rem' },
    },
  },
  plugins: [],
}
