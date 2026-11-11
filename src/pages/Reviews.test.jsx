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
