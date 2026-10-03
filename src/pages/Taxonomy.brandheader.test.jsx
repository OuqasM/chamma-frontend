// @vitest-environment jsdom
/**
 * The header at the top of a brand page, and the category header it shares code
 * with.
 *
 * The two look alike in the markup and are fed by different fields: a category
 * publishes an `image` object, a brand publishes a `logo` string. The page read
 * `image` for both, so the brand branch could never be taken and every brand
 * fell through to the bare heading — a brand page with no brand on it, which is
 * exactly the sort of thing a screenshot of the *products* below it hides.
 *
 * The other claim here is that the two are not treated identically even once the
 * field is found. A category photo is cropped to fill its header; a brand mark
 * is a 640x200 gold wordmark on transparency, so cropping it would cut the
 * lettering off at both ends. `object-contain` is load-bearing, not decoration.
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

const images = () => [...container.querySelectorAll('header img')]
const header = () => container.querySelector('header')

describe('a brand page shows the brand', () => {
  it('renders the logo the resource actually sends', async () => {
    payload = {
      data: [],
      meta: {
        brand: {
          id: 1,
          slug: 'rituals',
          name: 'Rituals',
          tagline: 'Maison de parfum',
          logo: '/images/brands/rituals.svg',
        },
      },
    }

    await render('brands')

    const found = images()
    expect(found).toHaveLength(1)
    expect(found[0].getAttribute('src')).toBe('/images/brands/rituals.svg')
    // The name is real text in the h1 right below, so the wordmark is empty for
    // a screen reader rather than a second reading of the same word.
    expect(found[0].getAttribute('alt')).toBe('')
    expect(container.querySelector('h1').textContent).toBe('Rituals')
  })

  it('contains the wordmark instead of cropping it to fill', async () => {
    payload = {
      data: [],
      meta: { brand: { id: 1, slug: 'rituals', name: 'Rituals', logo: '/images/brands/rituals.svg' } },
    }

    await render('brands')

    // A wordmark is transparent gold, so it needs the dark panel behind it; and
    // it is 640x200, so `object-cover` would slice the name off at both ends.
    expect(header().className).toContain('bg-noir')
    expect(images()[0].className).toContain('object-contain')
    expect(images()[0].className).not.toContain('object-cover')
  })

  it('still renders the products under the header', async () => {
    payload = {
      data: [{ id: 1 }, { id: 2 }],
      meta: { brand: { id: 1, slug: 'rituals', name: 'Rituals', logo: '/images/brands/rituals.svg' } },
    }

    await render('brands')

    expect(container.querySelector('[data-testid="grid"]').textContent).toBe('2')
  })

  it('falls back to the plain heading when a brand has no logo', async () => {
    payload = { data: [], meta: { brand: { id: 1, slug: 'x', name: 'X', logo: null } } }

    await render('brands')

    expect(images()).toHaveLength(0)
    expect(container.querySelector('h1').textContent).toBe('X')
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
    expect(found[0].className).not.toContain('object-contain')
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