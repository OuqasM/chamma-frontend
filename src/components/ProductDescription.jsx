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
export default function ProductDescription({
  description = '',
  description_html = '',
  translations = [],
}) {
  const { t } = useApp()

  // `null` is the page's own language. Keyed by locale so tapping the same
  // button twice puts the shopper's own description back, which is the way out
  // from a language they cannot read.
  const [active, setActive] = useState(null)

  const shown = active ? translations.find((entry) => entry.locale === active) : null
  const html = shown ? shown.description_html : description_html
  const text = shown ? shown.description : description

  // The revealed paragraph sets its own direction, or an Arabic description
  // renders left-aligned with its punctuation the wrong way round.
  const dir = shown ? shown.dir : undefined

  if (!description_html && !description && translations.length === 0) return null

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-xs uppercase tracking-widest text-stone-400">
          {t('product', 'description')}
        </h2>

        {translations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {translations.map((entry) => {
              const isActive = active === entry.locale

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
                  onClick={() => setActive(isActive ? null : entry.locale)}
                  className={`border px-2.5 py-1 text-[11px] font-medium transition ${
                    isActive
                      ? 'border-gold bg-gold text-white'
                      : 'border-stone-200 text-stone-600 hover:border-gold hover:text-gold'
                  }`}
                >
                  {entry.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div id="product-description-body" dir={dir} className="mt-2">
        {html ? (
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          text && <p className="text-sm leading-relaxed text-stone-700">{text}</p>
        )}
      </div>
    </div>
  )
}
