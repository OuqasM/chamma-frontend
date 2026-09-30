// @vitest-environment jsdom
/**
 * The Home carousel's speed.
 *
 * The component tests prove the Carousel honours whatever interval it is given.
 * That is not the same as knowing the interval the home page asks for, and the
 * first version of this file only tested the component — so the suite stayed
 * green while the page was set to 6 seconds. This renders Home and measures the
 * cadence of the carousel that actually ships.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// `logo` must be truthy: Home filters the brand tiles on it, so a brand with no
// image never reaches the carousel and the test would measure nothing.
const BRANDS = [
  { id: 1, slug: 'a', name: 'A', logo: 'a.png' },
  { id: 2, slug: 'b', name: 'B', logo: 'b.png' },
  { id: 3, slug: 'c', name: 'C', logo: 'c.png' },
]

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', dir: 'ltr', t: (_g, k) => k }),
}))

vi.mock('../lib/api', () => ({
  api: {
    home: () => Promise.resolve({
      hero: null,
      categories: [],
      brands: BRANDS,
      best_sellers: [],
      new_arrivals: [],
      offers: [],
    }),
  },
  imageUrl: () => null,
  absolute: (p) => `https://chammastore.com${p}`,
}))

vi.mock('../lib/seo', () => ({
  absolute: (p) => `https://chammastore.com${p}`,
  organisationJsonLd: () => ({}),
}))

vi.mock('../hooks/useSeo', () => ({ default: () => {} }))

// Home's product shelves now use `ProductCard`, not `ProductGrid`. The shelves
// stay empty in this file (see BRANDS note above), so neither is ever called —
// but leaving `ProductGrid` here would make the mock quietly wrong for the next
// person who adds a product to the fixture.
vi.mock('../components/ProductCard', () => ({
  ProductCard: () => null,
  ProductGrid: () => null,
}))
vi.mock('../components/Spinner', () => ({
  Spinner: () => <p>loading</p>,
  ErrorState: () => <p>error</p>,
}))

const { default: Home } = await import('../pages/Home')

let container
let root
let scrolls

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  scrolls = []
  const proto = window.HTMLElement.prototype
  proto.scrollBy = function (opts) {
    scrolls.push(opts.left)
  }
  proto.getBoundingClientRect = () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 100, height: 100 })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Renders Home and waits out the data fetch. */
const renderHome = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
  })
  await act(async () => {
    await Promise.resolve()
  })
  // The ResizeObserver-driven measurement settles a tick after mount.
  await act(async () => {
    vi.advanceTimersByTime(0)
  })
}

const advance = async (ms) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

describe('Home carousel cadence', () => {
  it('advances every 2.5 seconds', async () => {
    await renderHome()

    // Nothing may happen before the interval elapses.
    await advance(2400)
    expect(scrolls).toHaveLength(0)

    await advance(200)
    expect(scrolls).toHaveLength(1)

    await advance(2500)
    expect(scrolls).toHaveLength(2)

    await advance(2500)
    expect(scrolls).toHaveLength(3)
  })

  it('does not advance on a 6 second cadence', async () => {
    // Written out so the reason the value is pinned is visible: 6s was the old
    // setting and it looked fine in a screenshot because nothing moves in a
    // screenshot. Two ticks of 2.5s land here; a 6s timer would not have.
    await renderHome()

    await advance(2500 * 2)
    expect(scrolls).toHaveLength(2)
  })
})