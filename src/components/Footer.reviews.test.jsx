// @vitest-environment jsdom
/**
 * The footer's reviews link: the one place a visitor who never met the
 * floating prompt can still find the page. It points at the storefront page
 * in the current locale.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'ar',
    dir: 'rtl',
    t: (_group, key) => key,
    nav: { brands: [], categories: [] },
    contact: {},
    cartCount: 0,
    wishlist: [],
  }),
}))

vi.mock('../lib/api', () => ({ socialUrl: () => null }))

const { Footer } = await import('../components/Footer')

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
  vi.restoreAllMocks()
})

const hrefs = () => [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))

describe('the reviews link in the footer', () => {
  it('sits beside the shop links, in the current locale', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>,
      )
    })

    expect(hrefs()).toContain('/ar/reviews')
  })
})
