import { useState } from 'react'
import { useApp } from '../context/AppContext'

/**
 * A product's description, with one button per language it was written in.
 *
 * The buttons sit on the heading row and swap the paragraph underneath, rather
 * than opening a second copy lower down the page. Appending was the wrong
 * shape: it left the shopper reading a description that was no longer the one
 * the heading referred to, pushed a second block of prose below the notes and
 * the shipping, and made the length of the page depend on how many languages
 * happened to exist.
 *
 * The API withholds any language whose description was never written rather
 * than falling back to another one, so there is no way for a French paragraph
 * to appear under an Arabic button. When nothing is translated, no buttons
 * render and the section is simply the description — which is what a
 * single-language catalogue should look like.
 */
export default function ProductDescription({ translations = [] }) {
  const { t } = useApp()

  // The language the page is actually showing, which the API flags. This is not
  // necessarily the language in the URL: the page's description resolves
  // through a fallback chain, so an Arabic URL for a product written only in
  // French is displaying French copy, and the API says so. Preselecting from
  // the URL instead would put a French paragraph under an Arabic label and
  // present the store's fallback as its own Arabic writing.
  const current = translations.find((entry) => entry.is_current) ?? translations[0] ?? null

  // `null` only when the shopper has deliberately returned to the page's own
  // copy, which is what pressing the preselected button does.
  const [chosen, setChosen] = useState(null)
  const shown = (chosen ? translations.find((entry) => entry.locale === chosen) : null) ?? current

  if (translations.length === 0) return null

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-stone-200 pb-3">
        {/* One step darker and a touch larger than the other section headings
            on this page. It is the anchor for a control rather than a label
            sitting on its own, and at `stone-400` it was the faintest thing in
            the column — including the buttons it was labelling. */}
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-stone-600">
          {t('product', 'description')}
        </h2>

        <div className="flex flex-wrap gap-1.5">
          {translations.map((entry) => {
            const isActive = shown?.locale === entry.locale

            return (
              <button
                key={entry.locale}
                type="button"
                // aria-pressed, not aria-expanded: nothing is being revealed,
                // the same region is showing different content. "Expanded" on
                // a control with no panel behind it tells a screen reader
                // there is a disclosure to navigate to, and there is not.
                aria-pressed={isActive}
                aria-controls="product-description-body"
                // The language in its own script. Someone who cannot read the
                // page's language may not read its alphabet either, and
                // "Français" tells an Arabic reader nothing that "العربية"
                // does not tell them faster.
                onClick={() => setChosen(isActive ? null : entry.locale)}
                /* Sized to outrank the `Description` heading it sits beside.
                   At 11px in `stone-600` on a `stone-200` border it was within
                   a hair of the heading's own 12px grey, so the two read as one
                   line of small text and the buttons looked like part of a
                   label rather than the only control on the section. Now
                   `text-sm` at semibold in the ink: the same size as the
                   description body but a full weight class darker, which is
                   what separates a control from a label at this scale — and
                   larger than the 13px heading it sits beside, so the two
                   never read as one line of small text.

                   `text-noir` rather than inheriting, for the same reason the
                   price states it: the ambient body ink is what made it hard
                   to find. The active state is a solid fill so which language
                   you are reading is answered at a glance rather than by
                   tracking which label is tinted.

                   The resting border is `stone-400`, not the `stone-300` this
                   started on. At 300 the 1px edge measured 2.03:1 against
                   white, under the 3:1 WCAG asks of a control's boundary —
                   and the label alone does not say "button", so on this
                   control the border *is* the affordance. 400 lands at 6.5:1
                   and still sits well under the 15.2:1 of its own text, so
                   the hierarchy inside the button is unchanged. */
                className={`border px-3 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? 'border-gold bg-gold text-white'
                    : 'border-stone-400 bg-ivory text-noir hover:border-gold hover:text-gold'
                }`}
              >
                {entry.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* The paragraph sets its own direction, or an Arabic description renders
          left-aligned with its punctuation the wrong way round. Taken from
          whichever language is showing, not the URL's — on a fallback that is
          the direction of the copy actually on screen. */}
      <div id="product-description-body" dir={shown?.dir} className="mt-2">
        {shown?.description_html ? (
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: shown.description_html }} />
        ) : (
          shown?.description && <p className="text-sm leading-relaxed text-stone-700">{shown.description}</p>
        )}
      </div>
    </div>
  )
}
