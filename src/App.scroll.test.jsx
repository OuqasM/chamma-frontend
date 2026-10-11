// @vitest-environment jsdom
/**
 * A reload has to start at the top of the page.
 *
 * The storefront mounts a spinner and the shell first and the API fills the
 * page in afterwards. The browser's own scroll restoration replays the offset
 * it saved for the history entry against that short document and clamps to the
 * bottom of it, so a reload landed the shopper well down the real page with the
 * header out of sight. `index.html` turns that restoration off and `ScrollToTop`
 * resets on the first render as well as on a route change.
 *
 * jsdom has no layout and no `scrollTo`, so the position cannot be asserted —
 * only that the reset is asked for. That is the whole regression: the component
 * once skipped its first run to let the browser's restoration stand, which is
 * exactly the behaviour being removed.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('./lib/api', () => ({
  api: {
    navigation: vi.fn(() => Promise.resolve({ brands: [], categories: [], contact: null })),
    products: vi.fn(() => Promise.resolve({ data: [], meta: {} })),
    offers: vi.fn(() => Promise.resolve({ data: [], meta: {} })),
    search: vi.fn(() => Promise.resolve({ data: [], meta: {} })),
    checkoutOptions: vi.fn(() =>
      Promise.resolve({ cities: [], payment_methods: [], payment: { default: 'cod', bank: {} } }),
    ),
    quote: vi.fn(() => Promise.resolve({ shipping_cost: 0, total: 0 })),
  },
  imageUrl: (u) => u || '',
  socialUrl: () => null,
}))

const { default: App } = await import('./App')

let container
let root
let scrollTo

beforeEach(() => {
  localStorage.clear()
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

const visit = async (url) => {
  window.history.replaceState({}, '', url)
  await act(async () => {
    root.render(<App key={url} />)
  })
}

describe('scroll on a fresh mount', () => {
  it('resets to the top on the very first render, before the page has data', async () => {
    await visit('/fr/offers')

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })

  it('also resets when moving between routes', async () => {
    await visit('/fr/offers')
    scrollTo.mockClear()

    await visit('/fr/checkout')

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })
})
