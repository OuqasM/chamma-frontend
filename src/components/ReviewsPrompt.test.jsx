// @vitest-environment jsdom
/**
 * The floating reviews prompt.
 *
 * What is worth protecting here is the choreography the owner settled on:
 * 5 seconds of quiet, then the message for 3, and the button stays. Every
 * other number on this component is decoration; those three are the feature.
 * A session that has already seen the pitch gets the button straight back
 * without the line, and a shop with no reviews gets nothing at all.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const reviews = vi.fn()

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t: (_g, key) => key }),
}))

vi.mock('../lib/api', () => ({ api: { reviews } }))

const { default: ReviewsPrompt } = await import('../components/ReviewsPrompt')

let container
let root
let lastPath

function Probe({ initial }) {
  const location = useLocation()
  lastPath = location.pathname
  return <ReviewsPrompt />
}

beforeEach(() => {
  vi.useFakeTimers()
  reviews.mockReset()
  lastPath = null
  sessionStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

/** Render the prompt inside a router and let its fetch settle. */
const renderAt = async (pathname, payload) => {
  reviews.mockResolvedValue(payload)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[pathname]}>
        <Probe initial={pathname} />
      </MemoryRouter>,
    )
  })
  await act(async () => {})
}

const roundButton = () => container.querySelector('button[aria-label="popupButton"]')
const messageButton = () => [...container.querySelectorAll('button')].find((b) => b.textContent === 'popupMessage')

const withReviews = { data: [{ id: 1, image: 'uploads/a.png' }, { id: 2, image: 'uploads/b.png' }] }

describe('the 5s / 3s / stays choreography', () => {
  it('shows nothing during the first 5 seconds', async () => {
    await renderAt('/fr', withReviews)

    expect(roundButton()).toBeNull()
    expect(messageButton()).toBeUndefined()
  })

  it('raises the button and the message at 5 seconds', async () => {
    await renderAt('/fr', withReviews)

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(roundButton()).not.toBeNull()
    expect(messageButton()).toBeDefined()
    expect(sessionStorage.getItem('chamma_reviews_prompt_seen')).toBe('1')
  })

  it('keeps the button when the message leaves after 3 seconds', async () => {
    await renderAt('/fr', withReviews)

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    // The message is gone from the screen and the accessibility tree; the
    // button stays — that is the whole point of a persistent button.
    expect(messageButton()).toBeUndefined()
    expect(roundButton()).not.toBeNull()
  })

  it('opens the reviews page when the button is clicked', async () => {
    await renderAt('/fr', withReviews)

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    await act(async () => {
      roundButton().click()
    })

    expect(lastPath).toBe('/fr/reviews')
  })

  it('the message itself is clickable too', async () => {
    await renderAt('/fr', withReviews)

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    await act(async () => {
      messageButton().click()
    })

    expect(lastPath).toBe('/fr/reviews')
  })
})

describe('the once-per-session rule', () => {
  it('a second mount in the same session gets the button back without the 5s wait or the line', async () => {
    await renderAt('/fr', withReviews)
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    await act(async () => root.unmount())

    root = createRoot(container)
    await renderAt('/fr/products', withReviews)

    expect(roundButton()).not.toBeNull()
    expect(messageButton()).toBeUndefined()
  })

  it('a session that has seen nothing waits the full 5 seconds', async () => {
    await renderAt('/fr', withReviews)

    await act(async () => {
      vi.advanceTimersByTime(4999)
    })
    expect(roundButton()).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(roundButton()).not.toBeNull()
  })
})

describe('when the prompt stands down', () => {
  it('a shop with no reviews never shows anything', async () => {
    await renderAt('/fr', { data: [] })

    await act(async () => {
      vi.advanceTimersByTime(60000)
    })

    expect(roundButton()).toBeNull()
  })

  it('a failed read shows nothing rather than an empty promise', async () => {
    reviews.mockRejectedValue(new Error('down'))
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/fr']}>
          <Probe initial="/fr" />
        </MemoryRouter>,
      )
    })
    await act(async () => {})

    await act(async () => {
      vi.advanceTimersByTime(60000)
    })

    expect(roundButton()).toBeNull()
  })

  it('it is not on screen on the reviews page it would open', async () => {
    await renderAt('/fr/reviews', withReviews)

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(roundButton()).toBeNull()
  })
})
