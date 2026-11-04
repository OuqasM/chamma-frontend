// @vitest-environment jsdom
/**
 * Admin: the decisions the owner makes at the moment of the sale.
 *
 * A bottle that has just sold out, and a size that is discontinued for good.
 * Both are made while writing the order or while handing it over, so both
 * have to be one click away from there — and neither may touch the order.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const setProductAvailability = vi.fn()
const removeVariant = vi.fn()

const t = (_group, key) => key
const call = (fn) => fn(new AbortController().signal)

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call }),
}))

vi.mock('../../lib/api', () => ({
  adminApi: { setProductAvailability, removeVariant },
  api: {},
}))

const ProductActions = (await import('./ProductActions')).default

let container
let root

const click = async (element) => {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

const button = (label) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === label)

const render = async (props) => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ProductActions {...props} />
      </MemoryRouter>,
    )
  })
}

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
  setProductAvailability.mockClear()
  removeVariant.mockClear()
  setProductAvailability.mockResolvedValue({ product: {} })
  removeVariant.mockResolvedValue({ product: {} })
})

describe('AdminProductActions', () => {
  it('marks the product out of stock', async () => {
    await render({ productId: 7, productName: 'Oud Royale' })

    await click(button('markOutOfStock'))

    expect(setProductAvailability).toHaveBeenCalledTimes(1)
    // It says what it means: the state it wants, not a flip.
    const [, , available] = setProductAvailability.mock.calls[0]
    expect(available).toBe(false)

    expect(container.textContent).toContain('markedOutOfStock')
  })

  it('takes the size off the list when the line names one', async () => {
    await render({ productId: 7, productName: 'Oud Royale', variant: '100 ml' })

    await click(button('removeVariant'))

    expect(removeVariant).toHaveBeenCalledTimes(1)
    const [, , name] = removeVariant.mock.calls[0]
    expect(name).toBe('100 ml')

    expect(container.textContent).toContain('variantRemoved')
  })

  it('offers no size to remove on a product sold in one', async () => {
    await render({ productId: 7, productName: 'Oud Royale' })

    expect(button('removeVariant')).toBeFalsy()
    expect(button('markOutOfStock')).toBeTruthy()
  })

  /**
   * While the order is being written, the decision waits for the save: an
   * order the owner abandons must not leave the shop's stock changed.
   */
  it('queues the decision instead of making it, while the order is being written', async () => {
    const onQueue = vi.fn()

    await render({ productId: 7, productName: 'Oud Royale', onQueue })

    await click(button('markOutOfStock'))

    // Nothing was done to the shop.
    expect(setProductAvailability).not.toHaveBeenCalled()
    expect(removeVariant).not.toHaveBeenCalled()

    // It was handed to the order instead.
    expect(onQueue).toHaveBeenCalledWith({ type: 'out_of_stock', product_id: 7 })
  })

  it('shows a queued decision as waiting for the save', async () => {
    await render({ productId: 7, productName: 'Oud Royale', queuedStock: true })

    expect(button('queuedOutOfStock')).toBeTruthy()
    expect(button('markOutOfStock')).toBeFalsy()
  })
})
