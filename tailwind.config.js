/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "Blush rose" palette.
        //
        // The names are historical; the values are a soft pink-and-cream theme:
        //   noir  - deep plum, body and heading ink
        //   ivory - the page background, a warm cream
        //   gold  - blush pink, the primary accent
        //   sand  - warm neutral for panels and badges
        //   plum  - deeper mauve, the second accent
        //   jade  - muted sage, the one cool accent, kept so the "new" badge
        //           stays distinct from the pink accent and the error reds
        //
        // `gold` sits at hue 336, not the 344 the old accent used. At 344 the
        // accent lands in red-rose territory and reads as red rather than pink;
        // 336 is the same lightness and saturation but unmistakably pink. It is
        // the one value that has to work three ways — link text on cream, white
        // text on a `bg-gold` fill, and a hairline — and it clears AA (4.55 on
        // cream, 4.82 for white on fill) in all three.
        noir: '#3a1d27',
        ivory: '#fdf7f6',
        sand: '#f3ece7',
        gold: '#c83c74',
        plum: '#804261',
        jade: '#48793e',

        // The page is cream rather than white, so the light end of the `stone`
        // scale is warm too: a true grey next to a warm ground reads as a cold
        // patch rather than as a neutral. These are the large painted areas —
        // page sections, table stripes, input fills, the 1px rules on ~90 borders.
        //
        // 400 and darker stay rose: they are body and muted text, not surface.
        // 400/500/600 carry real text in this UI (51 `text-stone-400` calls on
        // their own), so all three clear WCAG AA (4.5:1) on **both** `ivory` and
        // white, since a few surfaces are still `bg-white`. 300 is decorative
        // only (spinner track, empty-image placeholder).
        stone: {
          50: '#fbf5f4',
          100: '#f7edec',
          200: '#efe2e1',
          300: '#dcc7c8',
          400: '#986170',
          500: '#8f5b69',
          600: '#80525e',
          700: '#6b444b',
          800: '#523239',
          900: '#38232a',
          950: '#221519',
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
