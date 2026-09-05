/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      sm: '480px',
      md: '640px',
      lg: '768px',
      xl: '1024px',
      '2xl': '1440px',
    },
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
          muted: 'var(--text-muted)',
        },
        /**
         * The four grey shades that actually carry body text, made THEME-AWARE.
         *
         * Roughly 3,500 text colours in this app are hardcoded Tailwind greys
         * rather than our `--text-*` tokens, so deepening the tokens alone moved
         * about 8% of the text. These four shades are ~2,400 of that total and
         * are used almost exclusively on text (`gray-500`: 1034 text vs 9 bg vs
         * 2 border), which makes remapping them safe.
         *
         * They cannot be remapped to a FIXED value, though: `gray-500` is a
         * light-mode workhorse (931 light / 95 dark) while `gray-400` is a
         * dark-mode one (258 light / 668 dark). Darkening both would fix one
         * theme and wreck the other. Pointing them at CSS variables lets each
         * shade resolve deeper on light and lighter on dark — which is what
         * "deeper" means in each theme — and it reaches every call site,
         * `dark:`-prefixed or not, without touching 245 files.
         *
         * The variables hold SPACE-SEPARATED RGB CHANNELS, not hex, and are
         * wrapped in `rgb(… / <alpha-value>)`. A bare `var(--x)` breaks every
         * opacity modifier in the codebase — `dark:bg-gray-600/20` fails to
         * compile at all, which is how this was caught.
         */
        gray: {
          300: 'rgb(var(--ink-gray-300) / <alpha-value>)',
          400: 'rgb(var(--ink-gray-400) / <alpha-value>)',
          500: 'rgb(var(--ink-gray-500) / <alpha-value>)',
          600: 'rgb(var(--ink-gray-600) / <alpha-value>)',
        },
        slate: {
          400: 'rgb(var(--ink-slate-400) / <alpha-value>)',
          500: 'rgb(var(--ink-slate-500) / <alpha-value>)',
        },

        // Legacy/Direct overrides
        dark: '#000000',
        'light-gray': '#f5f5f4',
        primary: '#9333EA',

        /**
         * Material 3 names used by the brand-verification screens.
         *
         * Five files were written against this vocabulary and it was never
         * defined here, so `bg-surface-container-lowest`, `text-on-surface`
         * and `border-outline-variant/20` emitted NO CSS at all — 192 dead
         * classes. The cards had no background, no text colour, and a border
         * that fell through to Tailwind's preflight default (see borderColor
         * below). That is the screen in the bug report.
         *
         * Aliased onto the WIEZ tokens rather than given their own palette:
         * the point is one source of truth, not a second theme.
         */
        'outline-variant': 'rgb(var(--m3-outline-variant) / <alpha-value>)',
        outline: 'rgb(var(--m3-outline-variant) / <alpha-value>)',
        'surface-container-lowest': 'rgb(var(--m3-surface-lowest) / <alpha-value>)',
        'surface-container-low': 'rgb(var(--m3-surface-low) / <alpha-value>)',
        'surface-container': 'rgb(var(--m3-surface-low) / <alpha-value>)',
        'surface-container-high': 'rgb(var(--m3-surface-high) / <alpha-value>)',
        'surface-container-highest': 'rgb(var(--m3-surface-highest) / <alpha-value>)',
        'on-surface': 'rgb(var(--m3-on-surface) / <alpha-value>)',
        'on-surface-variant': 'rgb(var(--m3-on-surface-variant) / <alpha-value>)',
        'on-primary': 'rgb(var(--m3-on-primary) / <alpha-value>)',
        tertiary: 'rgb(var(--m3-tertiary) / <alpha-value>)',
      },

      /**
       * Borders are themed SEPARATELY from text and fills.
       *
       * Two defects lived here, and both showed up as "the borders shout in
       * dark mode" while the sidebar beside them looked right.
       *
       * 1. `DEFAULT` is what Tailwind's preflight assigns to every element
       *    (`border-color: theme('borderColor.DEFAULT', currentColor)`), and
       *    it falls back to `colors.gray.200` — #e5e7eb. So any element with
       *    `border` / `border-t` and no colour class drew a near-WHITE line
       *    in both themes: 241 of them across 105 files, plus the 44 dead
       *    `border-outline-variant/*` above. It now follows the theme token,
       *    whose light value (#e5e5e5) is a neutral shade off the one it
       *    replaces, so light mode does not move.
       *
       * 2. The named shades resolved to `colors`, which the `--ink-*` remap
       *    above tunes for TEXT — `border-gray-300` was painting a hairline
       *    in rgb(223 227 233) on a near-black ground. The comment on
       *    `--ink-gray-600` records that collision being noticed and worked
       *    around by holding one text shade back from where it wanted to go.
       *    Pointing `borderColor` at its own `--bd-*` ramp ends the conflict:
       *    text and borders no longer share a knob, and every neutral family
       *    collapses to one NEUTRAL ramp in dark, so hairlines stop carrying
       *    the blue cast that `gray`/`slate`/`zinc` have at their dark steps.
       *
       * Both are config-only. No component changed, and light mode is
       * unchanged by construction — see the `--bd-*` block in index.css.
       */
      borderColor: {
        DEFAULT: 'var(--border-default)',
        gray: {
          50: 'rgb(var(--bd-gray-50) / <alpha-value>)',
          100: 'rgb(var(--bd-gray-100) / <alpha-value>)',
          200: 'rgb(var(--bd-gray-200) / <alpha-value>)',
          300: 'rgb(var(--bd-gray-300) / <alpha-value>)',
          400: 'rgb(var(--bd-gray-400) / <alpha-value>)',
          500: 'rgb(var(--bd-gray-500) / <alpha-value>)',
          600: 'rgb(var(--bd-gray-600) / <alpha-value>)',
          700: 'rgb(var(--bd-gray-700) / <alpha-value>)',
          800: 'rgb(var(--bd-gray-800) / <alpha-value>)',
          900: 'rgb(var(--bd-gray-900) / <alpha-value>)',
        },
        slate: {
          100: 'rgb(var(--bd-slate-100) / <alpha-value>)',
          200: 'rgb(var(--bd-slate-200) / <alpha-value>)',
          300: 'rgb(var(--bd-slate-300) / <alpha-value>)',
          400: 'rgb(var(--bd-slate-400) / <alpha-value>)',
          500: 'rgb(var(--bd-slate-500) / <alpha-value>)',
          600: 'rgb(var(--bd-slate-600) / <alpha-value>)',
          700: 'rgb(var(--bd-slate-700) / <alpha-value>)',
          900: 'rgb(var(--bd-slate-900) / <alpha-value>)',
          950: 'rgb(var(--bd-slate-950) / <alpha-value>)',
        },
        zinc: {
          600: 'rgb(var(--bd-zinc-600) / <alpha-value>)',
          700: 'rgb(var(--bd-zinc-700) / <alpha-value>)',
          800: 'rgb(var(--bd-zinc-800) / <alpha-value>)',
          900: 'rgb(var(--bd-zinc-900) / <alpha-value>)',
        },
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
        // The loading system. Constant angular velocity on purpose: an easing
        // curve stutters where the loop seams, and a spinner loops forever.
        'wiez-spin': {
          to: { transform: 'rotate(360deg)' },
        },
        'wiez-breathe': {
          '0%, 100%': { opacity: '0.78', transform: 'scale(0.97)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
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
        'wiez-spin': 'wiez-spin 1.25s linear infinite',
        'wiez-breathe': 'wiez-breathe 2.4s ease-in-out infinite',
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
