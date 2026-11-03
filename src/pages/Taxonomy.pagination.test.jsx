// @vitest-environment jsdom
/**
 * The page row on a brand or category page.
 *
 * The API has always answered these pages with a paginator — a brand with
 * twenty-one products came back as twelve rows and a second page — but the
 * page rendered the rows and nothing else. There was no page row, so the
 * second page was in the answer and nowhere on the screen: the products past
 * the first twelve were unreachable, and the page looked complete.
 *
 * A screenshot cannot catch this. The page it shows is a full grid of
 * products, and so is the broken one; what differs is the row underneath, and
 * what it means for the shopper is invisible until you count the products in
 * the store against the products on the page.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', dir: 'ltr', t: (_group, key) => key }),
}))

let payload = {}
const brand = vi.fn(() => Promise.resolve(payload))

vi.mock('../lib/api', () => ({
  PER_PAGE: 24,
  api: { brand, category: brand },
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
let scrollTo
let where

/** The location, so a click on a page number can be read back. */
function Where() {
  where = useLocation()
  return null
}

beforeEach(() => {
  payload = {
    data: [{ id: 1 }, { id: 2 }],
    meta: {
      brand: { id: 1, slug: 'ibraq', name: 'Ibraq' },
      links: [
        { url: null, label: '&laquo; Previous', active: false },
        { url: 'https://api.chammastore.com/api/fr/brands/ibraq?page=1', label: '1', active: true },
        { url: 'https://api.chammastore.com/api/fr/brands/ibraq?page=2', label: '2', active: false },
        { url: 'https://api.chammastore.com/api/fr/brands/ibraq?page=2', label: 'Next &raquo;', active: false },
      ],
      total: 21,
      last_page: 2,
    },
  }
  brand.mockClear()
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  scrollTo.mockRestore()
})

const render = async (url = '/fr/brands/ibraq') => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Where />
        <Routes>
          <Route path="/fr/:kind/:slug" element={<Taxonomy kind="brands" />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  await act(async () => Promise.resolve())
}

/** The page row's buttons. The mocked `t` hands back the key as the label. */
const pageButtons = () => [...container.querySelectorAll('nav[aria-label="pagination"] button')]

describe('a brand page pages through its products', () => {
  it('draws the page row the API asked for', async () => {
    await render()

    const labels = pageButtons().map((b) => b.textContent.trim())
    expect(labels).toContain('2')
  })

  it('asks the API for the page that was clicked', async () => {
    await render()

    const two = pageButtons().find((b) => b.textContent.trim() === '2' && !b.disabled)
    await act(async () => two.click())

    expect(brand).toHaveBeenLastCalledWith(
      'fr',
      'ibraq',
      expect.objectContaining({ params: expect.objectContaining({ page: '2' }) }),
    )
  })

  it('keeps the page number in the URL, so the listing can be shared', async () => {
    await render()

    const two = pageButtons().find((b) => b.textContent.trim() === '2' && !b.disabled)
    await act(async () => two.click())

    expect(where.pathname).toBe('/fr/brands/ibraq')
    expect(where.search).toBe('?page=2')
  })

  it('starts the new page at the top', async () => {
    await render()
    scrollTo.mockClear()

    const two = pageButtons().find((b) => b.textContent.trim() === '2' && !b.disabled)
    await act(async () => two.click())

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })

  it('opens on the page the URL asks for', async () => {
    await render('/fr/brands/ibraq?page=2')

    expect(brand).toHaveBeenCalledWith(
      'fr',
      'ibraq',
      expect.objectContaining({ params: expect.objectContaining({ page: '2' }) }),
    )
  })

  it('draws no page row when there is only one page', async () => {
    payload = {
      data: [{ id: 1 }],
      meta: {
        brand: { id: 1, slug: 'ibraq', name: 'Ibraq' },
        links: [
          { url: null, label: '&laquo; Previous', active: false },
          { url: 'https://api.chammastore.com/api/fr/brands/ibraq?page=1', label: '1', active: true },
          { url: null, label: 'Next &raquo;', active: false },
        ],
        total: 3,
        last_page: 1,
      },
    }

    await render()

    expect(pageButtons()).toHaveLength(0)
  })
})
