/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "Blush rose" palette on white.
        //
        // The names are historical; the values are a soft pink theme:
        //   noir  - deep plum, body and heading ink
        //   ivory - the page background, white
        //   gold  - blush pink, the primary accent
        //   sand  - neutral grey for panels and badges
        //   plum  - deeper mauve, the second accent
        //   sale  - red, for discounts only
        //   jade  - muted sage, the one cool accent, kept so the "new" badge
        //           stays distinct from the pink accent and the sale red
        //
        // `gold` sits at hue 336, not the 344 the old accent used. At 344 the
        // accent lands in red-rose territory and reads as red rather than pink;
        // 336 is the same lightness and saturation but unmistakably pink. It is
        // the one value that has to work three ways — link text, white text on a
        // `bg-gold` fill, and a hairline — and it clears AA in all three.
        //
        // A cream ground was tried and reverted. The product photography is shot
        // on white, so a warm page put a visible white rectangle inside every
        // card, and the photos are the point. The ground is white again; the
        // accent stays pink, which is what "reads as red" was actually about.
        noir: '#3a1d27',
        ivory: '#ffffff',
        sand: '#e6e6e6',
        gold: '#c83c74',
        plum: '#804261',
        jade: '#48793e',

        // `sale` is the only place the palette leaves the pink family, and it is
        // there on purpose: a discount has to read as a discount, and at 48%
        // saturation `plum` was too dusty to do it — it read as mauve trim rather
        // than as a price cut. Hue 2 is 334 degrees from the `gold` accent, so
        // the two can never be confused, and 87% saturation is what makes it
        // register as red at 10px rather than as a dark tint.
        //
        // Chosen at 5.21:1 against white text, not the 4.83:1 of a brighter red:
        // the badge is 10px bold, which is small text and needs the full 4.5
        // with room to spare for the white on a busy photographic background.
        sale: '#d4211b',

        // The light end of the `stone` scale is plain neutral grey. These are the
        // large painted areas — page sections, table stripes, input fills, the
        // 1px rules on ~90 borders — and across that much screen area a rose
        // tint reads as a pink cast rather than as brand. Each value keeps the
        // lightness of the rose one it replaces, so no contrast ratio moves.
        //
        // 400 and darker stay rose: they are body and muted text, not surface.
        // 400/500/600 carry real text in this UI (51 `text-stone-400` calls on
        // their own), so all three clear WCAG AA (4.5:1) on white. 300 is
        // decorative only (spinner track, empty-image placeholder).
        stone: {
          50: '#f9f9f9',
          100: '#f1f1f1',
          200: '#e3e3e3',
          300: '#b6b6b6',
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
