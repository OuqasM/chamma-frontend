// @vitest-environment jsdom
/**
 * The storefront reviews page: the screenshots the owner uploaded, in the
 * order the API sent them, and an honest empty state when there are none.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const reviews = vi.fn()

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', dir: 'ltr', t: (_g, key) => key }),
}))

vi.mock('../hooks/useSeo', () => ({ default: vi.fn() }))

vi.mock('../lib/api', () => ({
  api: { reviews },
  imageUrl: (u) => u,
}))

// The embedded store is its own page-sized component with its own reads; the
// page test stubs it and only asserts that it is on the page.
vi.mock('./Catalogue', () => ({ default: () => <div data-testid="embedded-catalogue" /> }))

const Reviews = (await import('./Reviews')).default

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
  reviews.mockReset()
})

const render = async (payload) => {
  reviews.mockResolvedValue(payload)
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Reviews />
      </MemoryRouter>,
    )
  })
  await act(async () => {})
}

describe('the reviews page', () => {
  it('draws one framed screenshot per review, in the order they arrive', async () => {
    await render({
      data: [
        { id: 7, image: 'https://api.chammastore.com/images/uploads/first.png' },
        { id: 8, image: 'https://api.chammastore.com/images/uploads/second.png' },
      ],
    })

    const images = [...container.querySelectorAll('img')]
    expect(images).toHaveLength(2)
    expect(images[0].getAttribute('src')).toContain('first.png')
    expect(images[1].getAttribute('src')).toContain('second.png')
  })

  it('shows one screenshot per view on every screen size', async () => {
    await render({
      data: [
        { id: 7, image: 'first.png' },
        { id: 8, image: 'second.png' },
      ],
    })

    // The carousel viewport carries the per-view custom property; one image
    // per view means exactly `[--pv:1]` with no breakpoint overrides.
    const viewport = container.querySelector('[class*="--pv"]')
    expect(viewport).not.toBeNull()
    expect(viewport.className).toContain('[--pv:1]')
    expect(viewport.className).not.toContain('sm:[')
    expect(viewport.className).not.toContain('lg:[')
  })

  it('the store follows the carousel, so the proof ends in a purchase', async () => {
    await render({ data: [{ id: 7, image: 'first.png' }] })

    // The embedded catalogue — the same cards and filters the home page
    // carries — sits under the carousel, on the reviews page and on the
    // empty one alike.
    expect(container.querySelector('[data-testid="embedded-catalogue"]')).not.toBeNull()
  })

  it('says so plainly when the shop has no reviews yet', async () => {
    await render({ data: [] })

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('empty')
  })

  it('waits for the answer instead of drawing an empty page', async () => {
    let resolve
    reviews.mockReturnValue(new Promise((r) => (resolve = r)))

    await act(async () => {
      root.render(
        <MemoryRouter>
          <Reviews />
        </MemoryRouter>,
      )
    })

    expect(container.querySelector('img')).toBeNull()

    await act(async () => {
      resolve({ data: [{ id: 1, image: 'x.png' }] })
    })
    await act(async () => {})

    expect(container.querySelectorAll('img')).toHaveLength(1)
  })
})
