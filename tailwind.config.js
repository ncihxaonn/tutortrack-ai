/** @type {import('tailwindcss').Config} */
// Ported verbatim from the former inline `tailwind.config` in index.html so the
// local build produces the exact same theme the Play CDN used to generate at
// runtime — but now bundled at build time (no third-party script executes).
export default {
  content: ['./index.html', './index.tsx', './App.tsx', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', './services/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#FAF7F2', soft: '#F5EFE4', border: '#EDE5D7' },
        coral: { 50: '#FDF2EB', 100: '#FBECE2', 200: '#F7DCC9', 500: '#D97757', 600: '#C6613F', 700: '#B45A3C', 800: '#923B20' }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif']
      },
      keyframes: {
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-8px)' },
          '40%,80%': { transform: 'translateX(8px)' }
        }
      },
      animation: {
        shake: 'shake 0.45s ease-in-out'
      }
    }
  },
  plugins: []
};
