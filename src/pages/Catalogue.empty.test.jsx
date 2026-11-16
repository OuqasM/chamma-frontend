// @vitest-environment jsdom
/**
 * The listing that comes back empty.
 *
 * A filter nothing matches, an offers page between two promotions, a page
 * number past the end: each used to render a bare "Aucun article" under the
 * default indexable metadata — a thin page on an HTTP 200 document, which is
 * what Google reports as a soft 404. An empty or failed listing is now
 * noindexed; a listing with rows stays indexable.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', dir: 'ltr', t: (_group, key) => key, nav: [] }),
}))

let answer = () => Promise.resolve([])

vi.mock('../lib/api', () => ({
  PER_PAGE: 24,
  api: {
    offers: () => answer(),
    products: () => answer(),
    search: () => answer(),
  },
}))

const seoCalls = []
vi.mock('../hooks/useSeo', () => ({
  default: (props) => {
    seoCalls.push(props)
  },
}))

vi.mock('../components/ProductCard', () => ({
  ProductGrid: ({ products }) => <div data-testid="grid">{products.length}</div>,
}))

vi.mock('../components/Pagination', () => ({
  Pagination: () => null,
}))

const { default: Catalogue } = await import('../pages/Catalogue')

let container
let root

beforeEach(() => {
  seoCalls.length = 0
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const render = async (mode = 'offers') => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/fr/${mode}`]}>
        <Routes>
          <Route path="/fr/:mode" element={<Catalogue mode={mode} />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  await act(async () => Promise.resolve())
}

describe('an offers page with nothing on it', () => {
  it('renders the empty state and noindexes the page', async () => {
    answer = () => Promise.resolve([])

    await render('offers')

    expect(container.textContent).toContain('empty')
    expect(container.querySelector('[data-testid="grid"]')).toBeNull()
    expect(seoCalls.at(-1).noindex).toBe(true)
  })

  it('keeps a listing with rows indexable', async () => {
    answer = () => Promise.resolve({ data: [{ id: 1 }], meta: { total: 1 } })

    await render('offers')

    expect(container.querySelector('[data-testid="grid"]').textContent).toBe('1')
    expect(seoCalls.at(-1).noindex).toBe(false)
  })
})

describe('a listing request that fails', () => {
  it('is noindexed while it shows the error', async () => {
    answer = () => Promise.reject(Object.assign(new Error('HTTP 500'), { name: 'ApiError', status: 500 }))

    await render('products')

    expect(seoCalls.at(-1).noindex).toBe(true)
  })
})
