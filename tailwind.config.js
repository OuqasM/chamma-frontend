/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "Fleur de rose" palette.
        //
        // The names are historical; the values are a rose-flower theme:
        //   noir  - deep wine, body and heading ink
        //   ivory - pale blush page background
        //   gold  - dusty rose, the primary accent (replaces the old gold)
        //   sand  - blush mid-tone for panels and rules
        //   plum  - muted mauve
        //   jade  - muted sage, the one cool accent, kept so the "new" badge
        //           stays distinct from the rose accent and the error reds
        noir: '#3d1f2b',
        ivory: '#fdf7f5',
        sand: '#f2dfe2',
        gold: '#b8506b',
        plum: '#8a5568',
        jade: '#4e8347',

        // Tailwind's stock `stone` is a warm grey. Re-tinting the scale towards
        // rose keeps the ~100 `stone-*` greys (borders, muted text, dividers) in
        // the same family as the accents, so nothing reads as cold grey.
        //
        // 400/500/600 carry real text in this UI, so they clear WCAG AA (4.5:1)
        // on both white and the ivory page background. 300 is decorative only
        // (spinner track, empty-image placeholder).
        stone: {
          50: '#fdf7f8',
          100: '#f9ecee',
          200: '#f2dade',
          300: '#d3a7a9',
          400: '#8e686a',
          500: '#7f6162',
          600: '#6f5758',
          700: '#574747',
          800: '#3f3535',
          900: '#292223',
          950: '#0e0c0c',
        },
      },
      fontFamily: {
        // Allura is a Latin-only script face, Amiri a naskh revival for Arabic.
        // Neither face covers the other's script, so this single stack resolves
        // per-glyph: FR/EN headings render in Allura, AR headings in Amiri.
        // Georgia/Times remain as a last-resort fallback.
        serif: [
          "'Allura'",
          'Amiri',
          'Georgia',
          "'Times New Roman'",
          'serif',
        ],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
