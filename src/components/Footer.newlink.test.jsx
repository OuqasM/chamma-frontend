// @vitest-environment jsdom
/**
 * Where "Nouveautés" points now that the `is_new` flag is gone.
 *
 * The flag was a stored boolean with its own filter, so the link that reached it
 * carried `?is_new=1`. Removing the column meant that URL silently did nothing:
 * it still rendered a full product grid, just not the newest-only one the link
 * promised, and the page was even titled "Nouveautés" while showing everything.
 * A stale link that degrades quietly is the worst kind, so the destination is
 * pinned here.
 *
 * `?sort=newest` was already `created_at DESC`, which is exactly what the flag
 * was approximating, so this is a rename rather than a behaviour change — which
 * is also why nothing about the storefront needs migrating.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'fr',
    dir: 'ltr',
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

describe('the new-arrivals link', () => {
  it('sorts by newest instead of filtering on the removed flag', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>,
      )
    })

    expect(hrefs()).toContain('/fr/products?sort=newest')
  })

  it('has no surviving reference to the removed flag', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>,
      )
    })

    // Asserted against the rendered output rather than the source, so a
    // reference reintroduced anywhere in the component tree still fails.
    expect(hrefs().join(' ')).not.toContain('is_new')
  })
})