import { useState } from 'react'
import { useApp } from '../context/AppContext'

/**
 * The other languages this product's description has been written in.
 *
 * A shopper who cannot read the description on the page has no way to ask for
 * one in their language: the whole decision to buy rests on copy they cannot
 * read. This surfaces the translations the store already holds.
 *
 * It only ever shows descriptions that genuinely exist. The API deliberately
 * withholds a language whose description was never written, rather than
 * falling back to another one — so a French paragraph under an Arabic heading
 * cannot appear here, which would look like the store wrote it and be worse
 * than showing nothing. When nothing has been translated, this renders nothing
 * at all rather than a control that opens onto an empty panel.
 */
export default function TranslatedDescription({ translations = [] }) {
  const { t } = useApp()
  // Keyed by locale so choosing the same one twice returns to the page's own
  // description, and so a shopper who opens Arabic, closes it and opens it
  // again gets the same answer rather than a fresh surprise.
  const [open, setOpen] = useState(null)

  if (translations.length === 0) return null

  const close = () => setOpen(null)

  return (
    <div className="mt-5 border-t border-stone-200 pt-4">
      <p className="text-xs uppercase tracking-widest text-stone-400">{t('product', 'otherLanguages')}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {translations.map((entry) => {
          const isOpen = open === entry.locale

          return (
            <button
              key={entry.locale}
              type="button"
              // aria-expanded so the relationship between the button and the
              // panel it reveals is announced, not just visible.
              aria-expanded={isOpen}
              aria-controls="translated-description"
              onClick={() => setOpen(isOpen ? null : entry.locale)}
              // The label is the language in its own script. A shopper who does
              // not read the page's language may well not read the page's
              // alphabet either, and "Français" tells an Arabic reader nothing
              // that "العربية" does not tell them faster.
              className={`border px-3 py-1.5 text-xs transition ${
                isOpen ? 'border-gold bg-gold/10 text-noir' : 'border-stone-200 text-stone-600 hover:border-gold'
              }`}
            >
              {entry.name}
            </button>
          )
        })}
      </div>

      {open && (
        <div id="translated-description" className="mt-4">
          {translations
            .filter((entry) => entry.locale === open)
            .map((entry) => (
              <section key={entry.locale} dir={entry.dir}>
                <h3 className="text-xs uppercase tracking-widest text-stone-400">
                  {t('product', 'descriptionIn', { language: entry.name })}
                </h3>
                {entry.description_html ? (
                  <div className="rich-text mt-2" dangerouslySetInnerHTML={{ __html: entry.description_html }} />
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">{entry.description}</p>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="mt-3 text-xs uppercase tracking-widest text-stone-400 underline hover:text-noir"
                >
                  {t('product', 'backToDescription')}
                </button>
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
