// @vitest-environment jsdom
/**
 * The catalogue's own scroll resets, which `ScrollToTop` cannot see.
 *
 * The catalogue never leaves its pathname: pagination and sorting are
 * `useSearchParams` writes that replace, and replacing a standing pathname is
 * the same write the filter chips use to edit the list in place. So the page
 * watches the listing itself — `page` and `sort` go to the top, filter edits
 * and the first render do not. jsdom has no layout, so the position cannot be
 * asserted; what is asserted is who asks the window to scroll, on which user
 * action, with what options.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'fr',
    t: (_g, key) => key,
    nav: {
      categories: [{ id: 1, name: 'Feminin', slug: 'feminin' }],
      brands: [],
    },
    addToCart: () => {},
    cart: [],
    toggleWishlist: () => {},
    inWishlist: () => false,
  }),
}))

vi.mock('../lib/api', () => ({
  api: {
    // One product and a two-page paginator, so the pagination row renders.
    products: () =>
      Promise.resolve({
        data: [{ id: 1, slug: 'snia', name: 'Snia', price: 10, stock: 1 }],
        meta: {
          total: 2,
          current_page: 1,
          last_page: 2,
          links: [
            { url: null, label: '&laquo; Previous', active: false },
            { url: '/fr/products?page=1', label: '1', active: true },
            { url: '/fr/products?page=2', label: '2', active: false },
            { url: '/fr/products?page=2', label: 'Next &raquo;', active: false },
          ],
        },
      }),
    offers: () => Promise.resolve({ data: [], meta: null }),
    search: () => Promise.resolve({ data: [], meta: null }),
  },
  imageUrl: (u) => u || null,
  productHref: (url, locale) => `/${locale}${url}`,
}))

const { default: Catalogue } = await import('./Catalogue')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root
let scrollTo

beforeEach(() => {
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

const render = async (url) => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Catalogue />
      </MemoryRouter>,
    )
  })
  // Let the fetch's state updates flush before any assertion.
  await act(async () => {})
}

describe(`the catalogue's scroll`, () => {
  it('does not scroll on its own when a page renders — ScrollToTop owns the mount', async () => {
    await render('/fr/products')

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('starts a paginated page at the top', async () => {
    await render('/fr/products')
    scrollTo.mockClear()

    const page2 = [...container.querySelectorAll('nav[aria-label="Pagination"] button')]
      .find((b) => b.textContent.trim() === '2' && !b.disabled)
    await act(async () => page2.click())

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })

  it('starts a re-sorted list at the top', async () => {
    await render('/fr/products')
    scrollTo.mockClear()

    const select = container.querySelector('select')
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      set.call(select, 'name')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })

  it(`keeps the shopper's scroll position when a filter chip edits the list in place`, async () => {
    await render('/fr/products?page=2')
    scrollTo.mockClear()

    const chip = container.querySelector('aside button[aria-pressed="false"]')
    await act(async () => chip.click())

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it("clears filters without yanking the page to the top", async () => {
    await render('/fr/products?category=feminin&page=2')
    scrollTo.mockClear()

    const clear = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('clearAll'))
    await act(async () => clear.click())

    expect(scrollTo).not.toHaveBeenCalled()
  })
})
