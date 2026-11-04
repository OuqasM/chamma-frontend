// @vitest-environment jsdom
/**
 * Admin: the button that marks a product out of stock.
 *
 * It is the thing the owner does most often when a bottle sells out, and it
 * was buried two clicks deep in a row's action menu. The button has to be
 * there, and it has to be the right one: a product that is already out of
 * stock offers to put it back.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const products = vi.fn()
const toggleProductAvailability = vi.fn()

const t = (_group, key) => key
const call = (fn) => fn(new AbortController().signal)

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call }),
}))

vi.mock('../../lib/api', () => ({
  adminApi: {
    products,
    toggleProductAvailability,
    brands: () => Promise.resolve({ data: [] }),
    categories: () => Promise.resolve({ data: [] }),
  },
  api: {},
}))

const AdminProducts = (await import('./Products')).default

const product = (overrides = {}) => ({
  id: 7,
  slug: 'oud-royale',
  sku: 'OUD1',
  preview: { name: 'Oud Royale', url: null },
  brand: { name: 'Chamma' },
  price: 890,
  cost_price: 500,
  stock: 3,
  is_active: true,
  is_available: true,
  ...overrides,
})

let container
let root

const click = async (element) => {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

const button = (label) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === label)

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
})

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  products.mockClear()
  toggleProductAvailability.mockClear()
  products.mockResolvedValue({ data: [product()], meta: {} })
  toggleProductAvailability.mockResolvedValue({ product: product({ is_available: false }) })
})

describe('AdminProducts stock', () => {
  it('marks the product out of stock from the row itself', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminProducts />
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(button('markOutOfStock')).toBeTruthy()

    await click(button('markOutOfStock'))

    expect(toggleProductAvailability).toHaveBeenCalledTimes(1)
  })

  it('offers to put a product that is already out of stock back', async () => {
    products.mockResolvedValue({
      data: [product({ is_available: false })],
      meta: {},
    })

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminProducts />
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(button('markInStock')).toBeTruthy()
    expect(button('markOutOfStock')).toBeFalsy()
  })
})
