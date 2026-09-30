// @vitest-environment jsdom
/**
 * The three product shelves on the home page, and when they move on their own.
 *
 * Two claims are easy to get wrong and invisible in a screenshot, because a
 * still image looks identical either way:
 *
 *  - Each shelf is a carousel holding exactly four products. A grid that quietly
 *    reverted to eight, or a shelf that rendered all four with no arrows, would
 *    both look fine in a screenshot and be wrong.
 *  - They autoplay on a phone and stand still from `lg` up. Nothing in a
 *    screenshot can tell a moving shelf from a static one, which is how a
 *    6-second interval survived review in Home.carousel.test.jsx's sibling.
 *
 * Brands are sent with no logo on purpose: Home filters the brand tiles on a
 * truthy `logo`, so an empty brands list keeps the brand carousel out of the
 * page and leaves these assertions measuring only the product shelves.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const shelf = (base) =>
  [0, 1, 2, 3].map((n) => ({
    id: base + n,
    slug: `p-${base + n}`,
    name: `Parfum ${base + n}`,
    url: `/p-${base + n}`,
    price: 890,
    stock: 5,
    in_stock: true,
    is_on_sale: false,
    discount_percent: 0,
  }))

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'fr',
    dir: 'ltr',
    t: (_group, key) => key,
    toggleWishlist: () => {},
    inWishlist: () => false,
  }),
}))

// Mutable so a test can hand back a store with nothing on one shelf, rather
// than asserting that the length guard exists without exercising it.
let payload = {}

vi.mock('../lib/api', () => ({
  api: { home: () => Promise.resolve(payload) },
  imageUrl: () => null,
  absolute: (p) => `https://chammastore.com${p}`,
}))

vi.mock('../lib/seo', () => ({
  absolute: (p) => `https://chammastore.com${p}`,
  organisationJsonLd: () => ({}),
}))

vi.mock('../hooks/useSeo', () => ({ default: () => {} }))

vi.mock('../components/ProductCard', () => ({
  ProductCard: ({ product }) => (
    <div data-testid="card" data-id={product.id}>
      {product.name}
    </div>
  ),
}))

vi.mock('../components/Spinner', () => ({
  Spinner: () => <p>loading</p>,
  ErrorState: () => <p>error</p>,
}))

const { default: Home } = await import('../pages/Home')

let container
let root
let scrolls
let width

/** jsdom has no matchMedia, and Carousel asks it two questions: whether the
 *  shopper asked for reduced motion, and whether the viewport is at least
 *  `autoplayBelow` wide. Both answers have to be controllable per test. */
const stubMatchMedia = () => {
  window.matchMedia = (query) => ({
    media: query,
    // Only the min-width query drives behaviour here; reduced motion is always
    // off, so an autoplay failure means the width gate and nothing else.
    matches: /min-width:\s*(\d+)px/.test(query) ? width >= Number(RegExp.$1) : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  width = 500
  payload = {
    hero: null,
    categories: [],
    brands: [],
    best_sellers: shelf(10),
    new_arrivals: shelf(20),
    offers: shelf(30),
  }
  stubMatchMedia()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  scrolls = []
  const proto = window.HTMLElement.prototype
  proto.scrollBy = function scrollBy(opts) {
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

const renderHome = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
  })
  await act(async () => Promise.resolve())
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

/** Each carousel region, in document order, with its accessible name. */
const shelves = () =>
  [...container.querySelectorAll('[aria-roledescription="carousel"]')].map((el) =>
    el.getAttribute('aria-label'),
  )

describe('home product shelves', () => {
  it('renders all three as carousels', async () => {
    await renderHome()

    expect(shelves()).toEqual(['topSellers', 'newArrivals', 'offers'])
  })

  it('shows the four products each shelf was sent, and no more', async () => {
    await renderHome()

    const cards = [...container.querySelectorAll('[data-testid="card"]')]

    // 4 x 3 shelves. A limit that reverted to eight server-side would show 24.
    expect(cards).toHaveLength(12)
    expect(cards.map((c) => Number(c.dataset.id))).toEqual([
      10, 11, 12, 13,
      20, 21, 22, 23,
      30, 31, 32, 33,
    ])
  })

  it('drops a shelf entirely when the store has nothing on it', async () => {
    // Without the length guard the Carousel would render an empty frame with
    // arrows and dots, which is a section heading promising nothing.
    payload = { ...payload, offers: [] }

    await renderHome()

    expect(shelves()).toEqual(['topSellers', 'newArrivals'])
    expect(container.textContent).not.toContain('Parfum 30')
  })
})

describe('home shelf autoplay', () => {
  it('advances on a phone, every 2.5 seconds', async () => {
    width = 500
    await renderHome()

    await advance(2400)
    expect(scrolls).toHaveLength(0)

    await advance(200)
    // Three shelves, one step each.
    expect(scrolls).toHaveLength(3)
  })

  it('stands still from lg up', async () => {
    width = 1280
    await renderHome()

    await advance(2500)
    expect(scrolls).toHaveLength(0)

    await advance(2500 * 4)
    expect(scrolls).toHaveLength(0)
  })

  it('still advances one pixel below the lg breakpoint', async () => {
    // The gate is Tailwind's `lg` = 1024px. Probing only 375 and 1440 would let
    // a rule that quietly means "tablet and below" pass, so the boundary itself
    // is pinned from both sides in these two tests.
    width = 1023
    await renderHome()

    await advance(2500)

    expect(scrolls.length).toBeGreaterThan(0)
  })

  it('is already still at exactly the lg breakpoint', async () => {
    width = 1024
    await renderHome()

    await advance(2500)

    expect(scrolls).toHaveLength(0)
  })
})