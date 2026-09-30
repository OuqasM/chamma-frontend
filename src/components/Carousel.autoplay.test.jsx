// @vitest-environment jsdom
/**
 * Carousel autoplay timing.
 *
 * The interval is the only thing here a shopper feels directly — a carousel
 * that drifts to 4s or stalls reads as broken without anything looking wrong.
 * Pinned with fake timers so the assertion is about behaviour, not about how
 * long a developer was willing to wait in a browser.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Tells React 18 it is under test control, so act() is not a no-op and state
// updates are flushed deterministically instead of warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ dir: 'ltr', t: (_g, k) => k }),
}))

const { default: Carousel } = await import('../components/Carousel')

const ITEMS = [{ id: 1 }, { id: 2 }, { id: 3 }]

let container
let root

/** Every scrollBy the carousel asked for. */
let scrolls

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  scrolls = []
  // jsdom has no layout and no scrollBy; the geometry is irrelevant here, only
  // how many times and in which direction the carousel asks to move.
  const proto = window.HTMLElement.prototype
  proto.scrollBy = function (opts) {
    scrolls.push(opts.left)
  }
  // One slide per page so paging is a plain index, with no --pv measurement.
  proto.getBoundingClientRect = function () {
    return { left: 0, right: 0, width: 100, height: 100, top: 0, bottom: 0 }
  }
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const render = async (props = {}) => {
  await act(async () => {
    root.render(
      <Carousel
        items={ITEMS}
        ariaLabel="brands"
        perViewClass="[--pv:1]"
        renderItem={(item) => <span>{item.id}</span>}
        {...props}
      />,
    )
  })
}

const advance = async (ms) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

describe('Carousel autoplay', () => {
  it('advances once per autoplay interval, not before', async () => {
    await render({ autoplay: 2500 })

    await advance(2400)
    expect(scrolls).toHaveLength(0)

    await advance(200)
    expect(scrolls).toHaveLength(1)
  })

  it('keeps the requested cadence over several intervals', async () => {
    await render({ autoplay: 2500 })

    await advance(2500 * 3)
    expect(scrolls).toHaveLength(3)
  })

  it('never runs when autoplay is 0', async () => {
    await render()

    await advance(10000)
    expect(scrolls).toHaveLength(0)
  })

  it('pauses while hovered and resumes after', async () => {
    await render({ autoplay: 2500 })

    await advance(2500)
    expect(scrolls).toHaveLength(1)

    await act(async () => {
      container.querySelector('[aria-roledescription="carousel"]').dispatchEvent(
        new MouseEvent('mouseover', { bubbles: true }),
      )
    })
    // React's onMouseEnter is synthesised from mouseover/out.
    await act(async () => {
      container.firstChild.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })

    await advance(5000)
    expect(scrolls).toHaveLength(1)

    await act(async () => {
      container.firstChild.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    })
    await advance(2500)
    expect(scrolls).toHaveLength(2)
  })

  it('does not run for a single slide', async () => {
    await render({ items: [{ id: 1 }], autoplay: 2500 })

    await advance(10000)
    expect(scrolls).toHaveLength(0)
  })
})