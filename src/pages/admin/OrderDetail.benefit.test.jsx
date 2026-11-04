// @vitest-environment jsdom
/**
 * The order detail states what an order earned, and where the figure came
 * from.
 *
 * Three things are pinned here: the **courier** reads as a cost of the sale in
 * its own right — the order was delivered free, and the parcel was paid for
 * anyway — the **calculation** is spelled out under the figure
 * (`total − goods − courier`) so a number the owner doubts can be read, and the
 * figure is **the owner's to correct**: what they set replaces the
 * calculation, and taking it away gives the calculation back.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const order = vi.fn()
const listOrders = vi.fn()
const updateOrderBenefit = vi.fn()
const updateOrderStatus = vi.fn()

const t = (_group, key, vars) => (vars ? `${key}:${vars[Object.keys(vars)[0]]}` : key)
const call = (fn) => fn(new AbortController().signal)

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call }),
}))

vi.mock('../../lib/api', () => ({
  adminApi: { order, orders: listOrders, updateOrderBenefit, updateOrderStatus },
  imageUrl: (path) => path || null,
}))

const AdminOrderDetail = (await import('./OrderDetail')).default

let container
let root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  root.unmount()
  container.remove()
  vi.clearAllMocks()
})

/**
 * A panel order the owner wrote: delivered the moment it was written, so its
 * figures are settled already.
 */
const savedOrder = {
  id: 41,
  reference: 'CP-2611-4821',
  status: 'delivered',
  next_status: null,
  payment_status: 'paid',
  payment_method: 'cod',
  subtotal: 1780,
  shipping_cost: 0,
  total: 1780,
  cost: 1000,
  courier_cost: 35,
  benefit: 745,
  benefit_override: null,
  currency: 'MAD',
  customer: { name: 'Amina Benali', phone: '0612345678' },
  city: 'CASABLANCA',
  address: '12 rue Ibn Batouta',
  items: [],
}

const renderWith = async (payload) => {
  order.mockResolvedValue({ order: payload })
  listOrders.mockResolvedValue({ data: [], meta: { statuses: [] } })

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/admin/orders/41']}>
        <Routes>
          <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

const text = () => container.textContent

const fmt = (n) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n)

describe('the benefit on the order detail', () => {
  it('states the delivery once, with the calculation spelled out', async () => {
    await renderWith(savedOrder)

    // One delivery fee, not two: what the customer pays and what the courier
    // costs are the same price, and the panel says it once.
    expect(text()).toContain('deliveryFee')
    expect(text()).not.toContain('courierCost')
    expect(text()).toContain(fmt(1000))
    expect(text()).toContain(fmt(745))
    expect(text()).toContain(`${fmt(1780)} − ${fmt(1000)} − ${fmt(35)}`)
  })

  it('opens a correction and stores the figure the owner typed', async () => {
    updateOrderBenefit.mockResolvedValue({
      order: { ...savedOrder, benefit: 900, benefit_override: 900 },
    })

    await renderWith(savedOrder)

    const correct = [...container.querySelectorAll('button')].find((b) => b.textContent === 'editBenefit')
    expect(correct).toBeTruthy()

    await act(async () => {
      correct.click()
    })
    expect(container.querySelector('input[type="number"]')).toBeTruthy()

    const input = container.querySelector('input[type="number"]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    await act(async () => {
      setter.call(input, '900')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const save = [...container.querySelectorAll('button')].find((b) => b.textContent === 'save')
    await act(async () => {
      save.click()
    })

    expect(updateOrderBenefit).toHaveBeenCalled()
    expect(updateOrderBenefit.mock.calls[0][2]).toBe(900)
    // And the owner's figure says so.
    expect(text()).toContain('benefitAdjusted')
  })

  it('gives the calculation back when the owner takes their figure away', async () => {
    updateOrderBenefit.mockResolvedValue({
      order: { ...savedOrder, benefit: 745, benefit_override: null },
    })

    await renderWith({ ...savedOrder, benefit_override: 900, benefit: 900 })

    const reset = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'resetBenefit',
    )
    expect(reset).toBeTruthy()

    await act(async () => {
      reset.click()
    })

    expect(updateOrderBenefit.mock.calls[0][2]).toBe(null)
  })

  it('offers no correction on an order that has not been delivered', async () => {
    await renderWith({
      ...savedOrder,
      status: 'new',
      next_status: 'confirmed',
      cost: null,
      courier_cost: null,
      benefit: null,
    })

    expect(
      [...container.querySelectorAll('button')].find((b) => b.textContent === 'editBenefit'),
    ).toBeFalsy()
    expect(text()).toContain('benefitUnsettled')
  })

  /**
   * The handover: the parcel goes out, and the figure the owner gives goes
   * out with it. It settles the benefit the moment the order is delivered.
   */
  it('sends the figure with the handover that delivers the order', async () => {
    updateOrderStatus.mockResolvedValue({
      order: { ...savedOrder, status: 'delivered', benefit: 800, benefit_override: 800 },
    })

    await renderWith({
      ...savedOrder,
      status: 'confirmed',
      next_status: 'delivered',
      cost: null,
      courier_cost: null,
      benefit: null,
    })

    const input = container.querySelector('[name="handover_benefit"]')
    expect(input).toBeTruthy()

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    await act(async () => {
      setter.call(input, '800')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const advance = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('advance'))
    await act(async () => {
      advance.click()
    })

    expect(updateOrderStatus).toHaveBeenCalled()
    const [, , status, figure] = updateOrderStatus.mock.calls[0]
    expect(status).toBe('delivered')
    expect(figure).toBe(800)
  })

  it('hands over without a figure when the owner gave none', async () => {
    updateOrderStatus.mockResolvedValue({ order: savedOrder })

    await renderWith({
      ...savedOrder,
      status: 'confirmed',
      next_status: 'delivered',
      cost: null,
      courier_cost: null,
      benefit: null,
    })

    const advance = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('advance'))
    await act(async () => {
      advance.click()
    })

    const [, , , figure] = updateOrderStatus.mock.calls[0]
    expect(figure).toBe(null)
  })
})
