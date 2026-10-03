// @vitest-environment jsdom
/**
 * The header at the top of a brand page, and the category header it shares code
 * with.
 *
 * The two look identical on the page and are fed by different fields: a category
 * publishes an `image` object, a brand publishes a `logo` string. The page read
 * `image` for both, so the brand header could never be built and every brand fell
 * through to the bare heading — a brand page with no brand on it, which is
 * exactly the sort of thing a screenshot of the *products* below it hides.
 *
 * The header itself is the full-bleed cover treatment, and that is the claim worth
 * pinning: the image fills the width edge to edge behind the scrim, for a brand
 * mark as much as for a category photo. A brand header that rendered its mark
 * small on a dark panel is a different page design, not a fix, and it is the kind
 * of regression that only shows up by looking.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', dir: 'ltr', t: (_group, key) => key }),
}))

let payload = {}

vi.mock('../lib/api', () => ({
  api: {
    brand: () => Promise.resolve(payload),
    category: () => Promise.resolve(payload),
  },
  // Faithful enough for the assertions: pass a path through, null for nothing.
  imageUrl: (url) => url || null,
}))

vi.mock('../hooks/useSeo', () => ({ default: () => {} }))

vi.mock('../components/ProductCard', () => ({
  ProductGrid: ({ products }) => <div data-testid="grid">{products.length}</div>,
}))

vi.mock('../components/Spinner', () => ({
  Spinner: () => <p>loading</p>,
  ErrorState: () => <p>error</p>,
}))

const { default: Taxonomy } = await import('../pages/Taxonomy')

let container
let root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const render = async (kind) => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/fr/${kind}/some-slug`]}>
        <Routes>
          <Route path="/fr/:kind/:slug" element={<Taxonomy kind={kind} />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  await act(async () => Promise.resolve())
}

const header = () => container.querySelector('header')
const images = () => [...header().querySelectorAll('img')]
const brand = (over = {}) => ({
  data: [],
  meta: { brand: { id: 1, slug: 'rituals', name: 'Rituals', logo: '/images/brands/rituals.svg', ...over } },
})

describe('a brand page shows the brand', () => {
  it('renders the logo the resource actually sends', async () => {
    payload = brand({ tagline: 'Maison de parfum' })

    await render('brands')

    const found = images()
    expect(found).toHaveLength(1)
    expect(found[0].getAttribute('src')).toBe('/images/brands/rituals.svg')
    expect(container.querySelector('h1').textContent).toBe('Rituals')
  })

  it('covers the full width of the top of the page', async () => {
    payload = brand()

    await render('brands')

    // The brand header is the category header: inset-0, object-cover, scrim.
    // Not a logo parked in the corner of a dark panel.
    const img = images()[0]
    expect(img.className).toContain('absolute')
    expect(img.className).toContain('inset-0')
    expect(img.className).toContain('object-cover')
    expect(img.className).toContain('w-full')
    expect(header().className).toContain('overflow-hidden')
    // The name sits over it in white, so the mark is decorative for a reader.
    expect(img.getAttribute('alt')).toBe('')
    expect(container.querySelector('h1').className).toContain('text-white')
  })

  it('still renders the products under the header', async () => {
    payload = brand()
    payload.data = [{ id: 1 }, { id: 2 }]

    await render('brands')

    expect(container.querySelector('[data-testid="grid"]').textContent).toBe('2')
  })

  it('falls back to the plain heading when a brand has no logo', async () => {
    payload = brand({ logo: null })

    await render('brands')

    expect(images()).toHaveLength(0)
    expect(container.querySelector('h1').textContent).toBe('Rituals')
  })
})

describe('a category page keeps its photograph', () => {
  it('crops the category photo to fill the dark hero', async () => {
    payload = {
      data: [],
      meta: {
        category: {
          id: 2,
          slug: 'femme',
          name: 'Femme',
          image: { url: '/images/categories/femme.jpg', width: 1200, height: 900 },
        },
      },
    }

    await render('categories')

    const found = images()
    expect(found).toHaveLength(1)
    expect(found[0].getAttribute('src')).toBe('/images/categories/femme.jpg')
    expect(found[0].className).toContain('object-cover')
  })

  it('never shows a category logo, which the resource does not send', async () => {
    payload = {
      data: [],
      meta: {
        category: {
          id: 2,
          slug: 'femme',
          name: 'Femme',
          image: { url: '/images/categories/femme.jpg' },
          logo: '/images/brands/rituals.svg',
        },
      },
    }

    await render('categories')

    expect(images()[0].getAttribute('src')).toBe('/images/categories/femme.jpg')
  })
})