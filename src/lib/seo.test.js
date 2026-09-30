/**
 * Canonical and hreflang regression tests.
 *
 * Both bugs here were silent and invisible in the rendered shop: the page looked
 * correct and the sitemap was correct, so nothing surfaced until the tags were
 * read back out of the DOM.
 *
 * Run with: npm test
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'

/** seo.js reads document.head on every call, so each test gets a fresh head. */
let dom

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
  globalThis.document = dom.window.document
})

const setSeo = async () => (await import('./seo.js')).setCanonical

const head = () => dom.window.document.head
const canonicals = () => head().querySelectorAll('link[rel="canonical"]')
const hreflangs = () => head().querySelectorAll('link[data-seo="hreflang"]')
const url = (path) => `https://chammastore.com/${path}`

describe('setCanonical', () => {
  it('writes a canonical when the document has none', async () => {
    // This is the regression: no canonical ships in index.html, and the old
    // code only rewrote an existing tag, so it wrote nothing at all and the
    // three locales of a product competed for the same content.
    const setCanonical = await setSeo()
    expect(canonicals()).toHaveLength(0)

    setCanonical({ canonical: url('fr/products/oud') })

    expect(canonicals()).toHaveLength(1)
    expect(canonicals()[0].getAttribute('href')).toBe(url('fr/products/oud'))
  })

  it('keeps exactly one canonical as the visitor moves between pages', async () => {
    // ensureLink matched on the href it was about to overwrite, so every
    // navigation appended another tag. Two canonicals is a conflicting signal.
    const setCanonical = await setSeo()

    setCanonical({ canonical: url('fr/products/oud') })
    setCanonical({ canonical: url('fr/products/musk') })

    expect(canonicals()).toHaveLength(1)
    expect(canonicals()[0].getAttribute('href')).toBe(url('fr/products/musk'))
  })

  it('replaces the hreflang set instead of accumulating it', async () => {
    // A page with fewer locales than the last one must not keep pointing at a
    // language it does not have. x-default is added by the function itself from
    // the default locale, so two declared alternates make three tags.
    const setCanonical = await setSeo()

    setCanonical({
      canonical: url('fr/products/oud'),
      alternates: { fr: url('fr/products/oud'), ar: url('ar/products/oud') },
    })
    expect(hreflangs()).toHaveLength(3)

    setCanonical({ canonical: url('fr/products/oud'), alternates: { fr: url('fr/products/oud') } })
    expect(hreflangs()).toHaveLength(2)
    expect([...hreflangs()].map((el) => el.getAttribute('hreflang')).sort()).toEqual([
      'fr',
      'x-default',
    ])
  })

  it('drops the hreflang set for a page that has none', async () => {
    const setCanonical = await setSeo()

    setCanonical({
      canonical: url('fr/products/oud'),
      alternates: { fr: url('fr/products/oud'), ar: url('ar/products/oud') },
    })
    setCanonical({ canonical: url('fr/cart'), alternates: {} })

    expect(hreflangs()).toHaveLength(0)
  })

  it('leaves the existing canonical alone when no URL is given', async () => {
    // resetSeo clears these on navigation; a page that supplies nothing should
    // not be credited with a canonical pointing at the page just left.
    const setCanonical = await setSeo()

    setCanonical({ canonical: url('fr/products/oud') })
    setCanonical({ canonical: null, alternates: {} })

    expect(canonicals()).toHaveLength(1)
  })

  it('does not let the canonical overwrite an hreflang tag', async () => {
    // The hreflang tags also carry an href, so a selector matching on href
    // rather than rel would reuse one of them and quietly rewrite the
    // Arabic alternate to point at the canonical.
    const setCanonical = await setSeo()

    setCanonical({
      canonical: url('fr/products/oud'),
      alternates: { fr: url('fr/products/oud'), ar: url('ar/products/oud') },
    })
    const arabicBefore = head().querySelector('link[hreflang="ar"]').getAttribute('href')

    setCanonical({ canonical: url('fr/products/musk'), alternates: {} })

    expect(canonicals()).toHaveLength(1)
    expect(canonicals()[0].getAttribute('href')).toBe(url('fr/products/musk'))
    // Cleared because this call declared no alternates, but it was not
    // repurposed as the canonical on the way out.
    expect(arabicBefore).toBe(url('ar/products/oud'))
    expect(head().querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
  })
})