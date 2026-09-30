/**
 * Brand glyphs for the follow row in the footer.
 *
 * Inline SVG rather than an icon font or a sprite sheet: three icons do not
 * justify a dependency or a network request, and inlining keeps them inheriting
 * `currentColor`, so a link's hover colour needs no second asset.
 *
 * Each path is drawn on a 24×24 grid with a 2px stroke weight to match the
 * hairline language of the rest of the site, except TikTok's note, which is a
 * solid glyph and is filled rather than stroked. `aria-hidden` is on every one:
 * the accessible name comes from the visible text beside the icon, so a screen
 * reader hears "Instagram", not "Instagram, graphic".
 */
export const SOCIAL_ICONS = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      {/* The lens: a circle, centred in the frame. */}
      <circle cx="12" cy="12" r="4" />
      {/* The dot in the top right, which is what makes it read as Instagram
          rather than as a generic camera. */}
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),

  tiktok: (
    <>
      {/* The note and the stem, as one filled path. */}
      <path
        fill="currentColor"
        stroke="none"
        d="M16.2 3h-2.4v11.4a2.3 2.3 0 1 1-1.9-2.26V9.6a4.7 4.7 0 1 0 4.3 4.68V9.1a5.9 5.9 0 0 0 3.4 1.09V7.75a3.6 3.6 0 0 1-3.4-3.6V3z"
      />
    </>
  ),

  whatsapp: (
    <>
      {/* Speech bubble with a tail, then the handset inside it. */}
      <path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.5L3.5 20.5l1.5-4.4A8.4 8.4 0 1 1 20.5 11.6z" />
      <path d="M8.9 8.4c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.7 1.6c.1.2 0 .4-.1.5l-.4.5c-.1.2-.2.3-.1.5a5.4 5.4 0 0 0 2.5 2.2c.2.1.4 0 .5-.1l.6-.7c.2-.2.3-.2.5-.1l1.5.8c.2.1.3.2.3.4a1.9 1.9 0 0 1-1.3 1.6c-.5.2-1.1.2-2.5-.4a8.2 8.2 0 0 1-3.6-3.3c-.6-1.2-.6-2.3-.4-2.8.1-.2.1-.3.2-.4z" />
    </>
  ),
}
