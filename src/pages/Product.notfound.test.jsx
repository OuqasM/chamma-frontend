// @vitest-environment jsdom
/**
 * A dead product link, and what the page tells a crawler about it.
 *
 * The API answers `firstOrFail()` with a real 404, but the document itself is
 * still the bundle at HTTP 200 — the web server cannot know a slug is dead, so
 * the status has to be answered for inside the page. The page used to render
 * the raw error message as its whole body under the default metadata (title =
 * the shop's name, robots "index, follow"): a thin, indexable "not found"
 * page, which is exactly what Google reports as a soft 404. Now a 404 renders
 * the shop's 404 view — which noindexes itself — and a page that failed any
 * other way is noindexed too.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'fr',
    dir: 'ltr',
    t: (_group, key) => key,
    toggleWishlist: () => {},
    inWishlist: () => false,
    cart: [],
  }),
}))

let answer = () => Promise.resolve({ product: { id: 1 } })

vi.mock('../lib/api', () => ({
  api: { product: () => answer() },
  imageUrl: (url) => url || null,
}))

const seoCalls = []
vi.mock('../hooks/useSeo', () => ({
  default: (props) => {
    seoCalls.push(props)
  },
}))

const { default: Product } = await import('../pages/Product')

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

const render = async (slug = 'dead-slug') => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/fr/products/${slug}`]}>
        <Routes>
          <Route path="/fr/products/:slug" element={<Product />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  await act(async () => Promise.resolve())
}

const apiError = (status) => Object.assign(new Error('Not Found.'), { name: 'ApiError', status })

describe('a product slug the API does not know', () => {
  it('renders the shop 404 view, not a bare error line', async () => {
    answer = () => Promise.reject(apiError(404))

    await render()

    expect(container.textContent).toContain('404')
    expect(container.querySelector('h1')).not.toBeNull()
  })

  it('hands the head to the 404 view, which noindexes the page', async () => {
    answer = () => Promise.reject(apiError(404))

    await render()

    // The page call stands down (`enabled: false`) — two writers on one
    // <head> fight, and the child's tags run first, so the parent's would
    // overwrite the noindex. The view's own call is the last one, and it is
    // the one that asks for the URL's removal.
    const pageCall = seoCalls.at(-2)
    const viewCall = seoCalls.at(-1)
    expect(pageCall.enabled).toBe(false)
    expect(viewCall.noindex).toBe(true)
    expect(viewCall.title).toBe('notFoundTitle')
  })

  it('renders the 404 view for a canonical-SKU slug that is gone too', async () => {
    answer = () => Promise.reject(apiError(404))

    await render('rit-sam-100')

    expect(container.textContent).toContain('404')
  })
})

describe('a product page that failed for any other reason', () => {
  it('is noindexed while it shows the error', async () => {
    answer = () => Promise.reject(apiError(500))

    await render()

    const pageCall = seoCalls.at(-1)
    expect(pageCall.noindex).toBe(true)
    expect(pageCall.enabled).toBe(true)
    expect(container.textContent).not.toContain('404')
  })
})

describe('a product the API knows', () => {
  it('stays indexable', async () => {
    answer = () =>
      Promise.resolve({
        product: {
          id: 1,
          name: 'Rituals',
          seo: {},
          image: null,
          price: 100,
          stock: 5,
          in_stock: true,
          description_translations: [],
        },
      })

    await render('rituals')

    expect(seoCalls.at(-1).noindex).toBe(false)
    expect(seoCalls.at(-1).enabled).toBe(true)
    expect(container.querySelector('h1').textContent).toBe('Rituals')
  })
})
