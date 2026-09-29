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
        //   ivory - the page background, now plain white
        //   gold  - dusty rose, the primary accent (replaces the old gold)
        //   sand  - neutral grey for panels and badges
        //   plum  - muted mauve
        //   jade  - muted sage, the one cool accent, kept so the "new" badge
        //           stays distinct from the rose accent and the error reds
        noir: '#3d1f2b',
        ivory: '#ffffff',
        sand: '#e6e6e6',
        gold: '#b8506b',
        plum: '#8a5568',
        jade: '#4e8347',

        // The light end of the `stone` scale is plain neutral grey. These are
        // the large painted areas — page sections, table stripes, input fills,
        // the 1px rules on ~76 borders — and across that much screen area the
        // rose tint read as a pink cast rather than as brand. Each value keeps
        // the lightness of the rose one it replaces, so no contrast ratio moves.
        //
        // 400 and darker stay rose: they are body and muted text, not surface,
        // and the rose is what keeps the type on-brand against a white page.
        // 400/500/600 carry real text in this UI, so they clear WCAG AA (4.5:1)
        // on white. 300 is decorative only (spinner track, empty-image
        // placeholder, hero eyebrow over a photo).
        stone: {
          50: '#f9f9f9',
          100: '#f1f1f1',
          200: '#e3e3e3',
          300: '#b6b6b6',
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
        // Amiri is a naskh revival covering Arabic only, so it leads and the
        // stack still resolves per-glyph: Arabic headings render in Amiri, Latin
        // headings fall through to Georgia. The decorative script face this
        // stack used to lead with has been dropped; see src/fonts.css.
        serif: [
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
