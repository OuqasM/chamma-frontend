// @vitest-environment jsdom
/**
 * Admin: what the shop took and what it earned.
 *
 * The orders list answers two questions the owner actually asks: what did the
 * shop take over this period, and what did it earn — the turnover minus the
 * purchase price of the goods. The figures are over the *filtered* orders and
 * not over the page on screen, because a page of twenty would answer a
 * different question.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const orders = vi.fn()

const t = (_group, key, vars) => (vars ? `${key}:${Object.values(vars)[0]}` : key)
const call = (fn) => fn(new AbortController().signal)

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call }),
}))

vi.mock('../../lib/api', () => ({
  adminApi: { orders },
  api: {},
}))

const AdminOrders = (await import('./Orders')).default

let container
let root

const type = async (element, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setter.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Load the panel and wait out the 250ms list debounce. */
const renderWith = async (payload) => {
  orders.mockResolvedValue(payload)

  await act(async () => {
    root.render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>,
    )
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300))
  })
}

/** The date inputs, by their type. */
const dateInput = (index) =>
  [...container.querySelectorAll('input[type="date"]')][index]

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
  orders.mockClear()
})

describe('AdminOrders figures', () => {
  it('shows the total sales and the benefit of the filtered orders', async () => {
    await renderWith({
      data: [],
      meta: {},
      summary: {
        orders: 12,
        total_sales: 2740,
        total_cost: 1500,
        total_benefit: 1240,
      },
    })

    const text = container.textContent
    expect(text).toContain('ordersTotalSales')
    expect(text).toContain('2.740')
    expect(text).toContain('ordersTotalBenefit')
    expect(text).toContain('1.240')
    // And what the goods cost, so the benefit is a sum anybody can check.
    expect(text).toContain('ordersCostHint:1.500')
  })

  it('filters the orders by a window of dates', async () => {
    await renderWith({ data: [], meta: {}, summary: { orders: 0, total_sales: 0, total_benefit: 0 } })

    await type(dateInput(0), '2026-11-01')
    await type(dateInput(1), '2026-11-30')

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })

    const [, params] = orders.mock.calls[orders.mock.calls.length - 1]
    expect(params).toMatchObject({ start_date: '2026-11-01', end_date: '2026-11-30' })
  })

  it('shows the benefit of each order', async () => {
    await renderWith({
      data: [
        {
          id: 3,
          reference: 'CP-2611-4182',
          customer: { name: 'Amina Benali', phone: '0612345678' },
          items: [],
          shipping: { city: 'CASABLANCA' },
          total: 1815,
          benefit: 815,
          currency: 'MAD',
          locale: 'fr',
          status: 'delivered',
          status_label: 'Livrée',
          status_color: 'emerald',
          created_at: '2026-11-04T10:00:00+00:00',
        },
      ],
      meta: {},
      summary: { orders: 1, total_sales: 1815, total_cost: 1000, total_benefit: 815 },
    })

    // The benefit is a column of its own: what the order earned is not the
    // same question as what it came to.
    expect(container.querySelector('thead').textContent).toContain('ordersBenefit')
    expect(container.querySelector('tbody tr').textContent).toContain('815')
  })
})
