// @vitest-environment jsdom
/**
 * Catalogue: the sort dropdown's labels, and the filter controls' selection
 * state.
 *
 * The dropdown used to render `slug.replace('_', ' ')`, which put the literal
 * text "price asc" into a `<select>` on the French and Arabic pages. It is
 * correct HTML and a broken-looking control, and nothing about the DOM flagged
 * it, so it is pinned here against the real dictionary rather than a mock that
 * echoes the key back.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_LOCALE, dictionaries } from '../lib/i18n'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// The real `t`, so the dotted-key lookup is exercised the way the page uses it.
const t = (locale, group, key) => {
  const path = String(key).split('.')
  const lookup = (dict) => path.reduce((n, s) => (n == null ? undefined : n[s]), dict)
  return lookup(dictionaries[locale]?.[group]) ?? lookup(dictionaries[DEFAULT_LOCALE]?.[group]) ?? key
}

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'fr',
    t: (_g, key) => t('fr', _g, key),
    nav: {
      categories: [
        { id: 1, name: 'Feminin', slug: 'feminin' },
        { id: 2, name: 'Masculin', slug: 'masculin' },
      ],
      brands: [{ id: 1, name: 'Sana', slug: 'sana' }],
    },
    addToCart: () => {},
    cart: [],
    toggleWishlist: () => {},
    inWishlist: () => false,
  }),
}))

// One empty paginator for every catalogue endpoint, so the grid stays empty
// and the only thing these tests read is the toolbar above it.
const empty = () => Promise.resolve({ data: [], meta: { total: 0 } })
const products = vi.fn(empty)
const offers = vi.fn(empty)
const search = vi.fn(empty)

vi.mock('../lib/api', () => ({
  api: { products, offers, search },
  imageUrl: (u) => u || null,
  productHref: (url, locale) => `/${locale}${url}`,
}))

const { default: Catalogue } = await import('./Catalogue')

let container
let root

// The first render is awaited, not fired and asserted on: the catalogue reads
// the URL and the navigation payload, so asserting against an un-flushed tree
// would be asserting on an empty container and pass for the wrong reason.
const render = async (url) => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Catalogue mode="all" />
      </MemoryRouter>,
    )
  })
}

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  products.mockClear()
  offers.mockClear()
  search.mockClear()
})

describe('Catalogue sort options', () => {
  it('labels every option in the page language, not with the raw slug', async () => {
    // The regression: "price_asc" with its underscore swapped for a space.
    await render('/fr/boutique')

    const labels = [...container.querySelectorAll('select option')].map((o) => o.textContent)

    expect(labels).toContain('Prix croissant')
    expect(labels).toContain('Prix décroissant')
    expect(labels).toContain('Recommandés')
    expect(labels).not.toContain('price asc')
    expect(labels).not.toContain('price_asc')
    // Every slug still has a label, so no option renders as its own key.
    expect(labels.every((l) => l && !l.includes('_'))).toBe(true)
  })

  it('keeps the slug as the submitted value while showing a translated label', async () => {
    // The wire value is the API's, not ours. Relabelling the option must not
    // change what a chosen sort sends, or the saved link and the server's
    // ordering disagree.
    await render('/fr/boutique')

    const options = [...container.querySelectorAll('select option')]
    const ascending = options.find((o) => o.textContent === 'Prix croissant')

    expect(ascending?.value).toBe('price_asc')
  })
})

describe('Catalogue filter lists', () => {
  it('marks the selected category for assistive tech, not with colour alone', async () => {
    await render('/fr/boutique?category=masculin')

    const pressed = [...container.querySelectorAll('button[aria-pressed="true"]')]

    // Exactly the one in the sidebar that is actually active. A list that marks
    // everything, or nothing, is worse than one that does not mark at all,
    // because it looks like the state is being reported.
    expect(pressed).toHaveLength(1)
    expect(pressed[0].textContent).toContain('Masculin')
  })

  it('puts the price bounds in the URL, so a filtered view is a shareable link', async () => {
    await render('/fr/boutique?min_price=200&max_price=900')

    // Both fields have to reflect the URL on arrival, otherwise a shopper who
    // arrives at a filtered link and then widens the price range does not know
    // what they are narrowing from.
    const [min, max] = [...container.querySelectorAll('input[type="number"]')]

    expect(min.value).toBe('200')
    expect(max.value).toBe('900')
  })
})
