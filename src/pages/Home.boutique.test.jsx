// @vitest-environment jsdom
/**
 * The home page shows the boutique.
 *
 * The three shelves it used to carry — "Les plus aimés", "Fraîchement
 * arrivés", "Nos coups de cœur" — showed twelve products between them, and
 * the rest of the shop was one menu item away. A visitor who never opened
 * that menu found a dozen perfumes in a store that carries hundreds. The
 * page now carries the boutique's own view instead: the whole catalogue,
 * with the filters that find them and the page row that walks through them.
 *
 * Three things are pinned here:
 *
 *  - The catalogue is *on* the page, not a link to it. A link would leave
 *    the client needing the menu again.
 *  - The shelves are gone. A shelf that stayed would put four products back
 *    on the page, above the list of everything.
 *  - The embedded catalogue leaves the metadata alone. It is the same
 *    component the boutique page renders, and it writes a canonical and a
 *    description of its own; on the home page it would replace the home
 *    page's canonical with the boutique's, and the crawler would index the
 *    landing page as a copy of a listing.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const products = vi.fn(() =>
  Promise.resolve({
    data: [
      { id: 1, slug: 'oud', name: 'Oud', price: 890, stock: 3 },
      { id: 2, slug: 'rose', name: 'Rose', price: 640, stock: 2 },
    ],
    meta: { total: 2, last_page: 1 },
  }),
)

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'fr',
    dir: 'ltr',
    t: (_group, key) => key,
    toggleWishlist: () => {},
    inWishlist: () => false,
  }),
}))

vi.mock('../lib/api', () => ({
  PER_PAGE: 24,
  api: {
    home: () =>
      Promise.resolve({
        hero: null,
        categories: [],
        brands: [],
        best_sellers: [],
        new_arrivals: [],
        offers: [],
      }),
    products,
    offers: vi.fn(() => Promise.resolve({ data: [], meta: null })),
    search: vi.fn(() => Promise.resolve({ data: [], meta: null })),
  },
  imageUrl: () => null,
  productHref: (url, locale) => `/${locale}${url}`,
}))

vi.mock('../components/ProductCard', () => ({
  ProductCard: () => null,
  ProductGrid: ({ products }) => <div data-testid="grid">{products.length}</div>,
}))

vi.mock('../components/Spinner', () => ({
  Spinner: () => <p>loading</p>,
  ErrorState: () => <p>error</p>,
}))

const { default: Home } = await import('../pages/Home')

let container
let root

beforeEach(() => {
  products.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove())
})

const renderHome = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
  })
  await act(async () => Promise.resolve())
}

describe('the home page shows the boutique', () => {
  it('asks the catalogue for the products, and shows them', async () => {
    await renderHome()

    expect(products).toHaveBeenCalled()
    expect(container.querySelector('[data-testid="grid"]').textContent).toBe('2')
  })

  it('carries no product shelf any more', async () => {
    await renderHome()

    // One carousel left: the brand tiles. The three product shelves are gone.
    const carousels = [...container.querySelectorAll('[aria-roledescription="carousel"]')]
    expect(carousels).toHaveLength(0)
  })

  it('has one heading of the page, and the catalogue is not it', async () => {
    await renderHome()

    // The hero owns the h1. The catalogue is an h2 inside it, so the page
    // does not claim two different things about itself.
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(container.querySelector('h2')).not.toBeNull()
  })

  it('leaves the metadata to the home page', async () => {
    await renderHome()

    const canonical = document.head.querySelector('link[rel="canonical"]')

    expect(canonical).not.toBeNull()
    expect(canonical.getAttribute('href')).toContain('/fr')
    // The boutique's own canonical would have replaced it.
    expect(canonical.getAttribute('href')).not.toContain('/products')
  })
})
