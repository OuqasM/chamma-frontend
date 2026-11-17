/**
 * The reviews prompt's line is Darija on every language.
 *
 * The owner first had it translated per language, saw it live, and asked for
 * Darija everywhere: the shop's customers read Darija whichever language they
 * browse in, so the one line that advertises the reviews says it the way the
 * customers say it — even on the French and English pages. This pins the
 * decision, because the natural drift afterwards is exactly back towards
 * "translate it like everything else".
 *
 * Only `popupMessage` is language-free. The reviews page's title, the footer
 * link and the panel's labels stay translated.
 */
import { describe, expect, it } from 'vitest'
import { dictionaries } from './i18n'

const DARIJA = 'بغيتي تعرف شنو كيقولوا علينا ؟'

describe('the reviews prompt line', () => {
  it('is the same Darija line on fr, ar and en', () => {
    for (const locale of Object.keys(dictionaries)) {
      expect(dictionaries[locale].reviews.popupMessage).toBe(DARIJA)
    }
  })

  it('is still translated everywhere else in the feature', () => {
    // The decision is narrow: one key. If the page title ever "simplified"
    // into the same string on every language, this fails and asks why.
    expect(dictionaries.fr.reviews.title).not.toBe(DARIJA)
    expect(dictionaries.en.reviews.title).not.toBe(DARIJA)
    expect(dictionaries.ar.reviews.title).not.toBe(dictionaries.fr.reviews.title)
  })
})
