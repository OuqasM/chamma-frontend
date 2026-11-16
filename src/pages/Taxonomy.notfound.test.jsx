// @vitest-environment jsdom
/**
 * A dead brand link, and a brand that lists nothing.
 *
 * Both used to ship as thin, indexable pages on an HTTP 200 document: a slug
 * the API does not know rendered the raw error message, and an entity with no
 * products rendered a bare "Aucun article". Both are exactly what Google
 * reports as soft 404s. A 404 now renders the shop's 404 view (which
 * noindexes itself), and an empty listing noindexes the page until it has
 * something to show.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', dir: 'ltr', t: (_group, key) => key }),
}))

let answer = () => Promise.resolve({ data: [], meta: { brand: {} } })

vi.mock('../lib/api', () => ({
  PER_PAGE: 24,
  api: {
    brand: () => answer(),
    category: () => answer(),
  },
  imageUrl: (url) => url || null,
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

const { default: Taxonomy } = await import('../pages/Taxonomy')

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

const render = async (kind = 'brands', slug = 'some-slug') => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/fr/${kind}/${slug}`]}>
        <Routes>
          <Route path="/fr/:kind/:slug" element={<Taxonomy kind={kind} />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  await act(async () => Promise.resolve())
}

const apiError = (status) => Object.assign(new Error('Not Found.'), { name: 'ApiError', status })

const brand = (products = [], over = {}) => ({
  data: products,
  meta: { brand: { id: 1, slug: 'rituals', name: 'Rituals', ...over } },
})

describe('a brand slug the API does not know', () => {
  it('renders the shop 404 view instead of the error message', async () => {
    answer = () => Promise.reject(apiError(404))

    await render()

    expect(container.textContent).toContain('404')
    expect(container.querySelector('h1')).not.toBeNull()
  })

  it('hands the head to the 404 view, which noindexes the page', async () => {
    answer = () => Promise.reject(apiError(404))

    await render()

    const pageCall = seoCalls.at(-2)
    const viewCall = seoCalls.at(-1)
    expect(pageCall.enabled).toBe(false)
    expect(viewCall.noindex).toBe(true)
    expect(viewCall.title).toBe('notFoundTitle')
  })

  it('does the same for a dead category', async () => {
    answer = () => Promise.reject(apiError(404))

    await render('categories', 'gone')

    expect(container.textContent).toContain('404')
  })
})

describe('a brand that lists nothing', () => {
  it('still shows the brand page, but noindexes it', async () => {
    answer = () => Promise.resolve(brand())

    await render()

    expect(container.querySelector('h1').textContent).toBe('Rituals')
    expect(seoCalls.at(-1).noindex).toBe(true)
  })

  it('keeps a stocked brand indexable', async () => {
    answer = () => Promise.resolve(brand([{ id: 1 }, { id: 2 }]))

    await render()

    expect(container.querySelector('[data-testid="grid"]').textContent).toBe('2')
    expect(seoCalls.at(-1).noindex).toBe(false)
  })
})
