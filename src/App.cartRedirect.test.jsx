// @vitest-environment jsdom
/**
 * Where `/cart` goes now that the cart page has been merged into checkout.
 *
 * The cart page was its own step between "add to cart" and "checkout": a click
 * onto a page of lines, and another click onto the form. With the drawer, a
 * shopper buying one thing never sees either, so the page existed only for
 * everyone else — and then it was not carrying anything the checkout summary
 * could not carry too.
 *
 * It is redirected rather than deleted. A link somewhere off-site, a bookmark,
 * or a URL already shared on Instagram outlives any refactor of ours, and a
 * 410 on a URL we once handed out is a small thing to avoid.
 *
 * Asserted per locale because the redirect has to resolve *within* the locale
 * segment. An earlier version interpolated the locale from a variable that was
 * not in scope where the route table is written, which produced
 * `/undefined/checkout` — a path that renders the not-found page, so the
 * redirect would have "worked" in a smoke test and sent everyone to a dead end.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('./lib/api', () => ({
  api: {
    navigation: vi.fn(() => Promise.resolve({ brands: [], categories: [], contact: null })),
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

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

// `App` mounts its own BrowserRouter, so the URL under test is set the way a
// visitor would set it: by arriving on it.
const visit = async (url) => {
  window.history.replaceState({}, '', url)
  await act(async () => {
    // Keyed so each URL gets a fresh mount. `BrowserRouter` reads
    // `window.location` once, when it mounts, and `replaceState` fires no
    // popstate — so re-rendering the same <App /> leaves the previous URL
    // showing, and the second visit in a loop would silently re-assert the
    // first.
    root.render(<App key={url} />)
  })
}

describe('the merged cart page', () => {
  it('lands on checkout', async () => {
    await visit('/fr/cart')

    expect(window.location.pathname).toBe('/fr/checkout')
  })

  it('keeps the locale on the way through, in every language', async () => {
    for (const locale of ['fr', 'ar', 'en']) {
      await visit(`/${locale}/cart`)
      expect(window.location.pathname).toBe(`/${locale}/checkout`)
      // No cart is needed to check the redirect, and clearing between visits
      // keeps one locale's state out of the next locale's render.
      localStorage.clear()
    }
  })

  it('arrives on the checkout page itself, not just on a checkout URL', async () => {
    localStorage.setItem(
      'chamma_cart',
      JSON.stringify([{ id: 1, slug: 'oud', name: 'Oud Impérial', price: 5000, quantity: 1, stock: 3, image: null }]),
    )

    await visit('/fr/cart')

    // The URL is not the outcome. A redirect that lands on a path no route
    // matches leaves the shopper on the not-found page with a URL that looks
    // right, which is how a broken redirect passes a smoke test. The heading is
    // what proves the checkout form is actually on screen.
    const { dictionaries } = await import('./lib/i18n')
    expect(container.textContent).toContain(dictionaries.fr.checkout.title)
  })
})
