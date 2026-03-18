/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
      },
      colors: {
        border: "var(--border-default)",
        input: "var(--border-default)",
        ring: "var(--brand-primary)",
        background: "var(--surface-primary)",
        foreground: "var(--text-primary)",
        brand: {
          primary: 'var(--brand-primary)',
          'primary-strong': 'var(--brand-primary-strong)',
          accent: 'var(--brand-accent)',
          dark: '#000000',
          gold: '#D4AF37',
        },
        surface: {
          primary: 'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          muted: 'var(--surface-muted)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        // Editorial text scale
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        // Legacy/Direct overrides
        dark: '#000000',
        'light-gray': '#f5f5f4',
        primary: '#9333EA',
      },
      fontSize: {
        // Editorial scale — Playfair Display sizes
        'display-xl': ['4rem',   { lineHeight: '1.05', letterSpacing: '-0.03em'  }],
        'display-lg': ['3rem',   { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        'display-md': ['2.25rem',{ lineHeight: '1.1',  letterSpacing: '-0.02em'  }],
        'display-sm': ['1.75rem',{ lineHeight: '1.15', letterSpacing: '-0.015em' }],
        // UI scale — Plus Jakarta Sans
        'ui-xl': ['1.25rem',  { lineHeight: '1.4',  letterSpacing: '-0.01em'  }],
        'ui-lg': ['1.125rem', { lineHeight: '1.45', letterSpacing: '-0.005em' }],
        'ui-md': ['1rem',     { lineHeight: '1.5',  letterSpacing: '0'        }],
        'ui-sm': ['0.875rem', { lineHeight: '1.5',  letterSpacing: '0.005em'  }],
        'ui-xs': ['0.75rem',  { lineHeight: '1.5',  letterSpacing: '0.01em'   }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
        'glass-shine': 'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out': 'fade-out 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-in-from-bottom': 'slide-in-from-bottom 0.4s ease-out',
        'slide-up-fade': 'slide-up-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        float: 'float 6s ease-in-out infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-hover': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glow': '0 0 20px rgba(147, 51, 234, 0.5)',
        'glow-sm': '0 0 10px rgba(147, 51, 234, 0.3)',
      },
    },
  },
  plugins: [],
}
