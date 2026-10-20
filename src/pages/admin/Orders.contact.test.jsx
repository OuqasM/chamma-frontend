// @vitest-environment jsdom
/**
 * Admin: the per-row WhatsApp contact button on the orders list.
 *
 * The behaviour worth protecting is all in the payload contract and the href:
 * the owner clicks a row's button expecting the customer's chat, so the link
 * must be the resource's wa.me address exactly as the server built it, and a
 * row without a dialable number must show nothing rather than a dead link.
 *
 * The link is built server-side on purpose: wa.me needs bare international
 * digits while the order stores the phone as it was typed, and the Moroccan
 * normalisation rules live in one place in `App\Support\PhoneNumber`. This
 * suite therefore does not re-derive any of them — it only watches that what
 * the server says is what the owner gets.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const orders = vi.fn()
const products = vi.fn(() => Promise.resolve({ data: [] }))

// Same shape as the panel's real `t`: it is a mock everywhere in the admin
// pages, so the assertions reach the markup by key, not by a translated word.
const t = (_group, key, vars) => (vars ? `${key}:${Object.values(vars)[0]}` : key)

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call: (fn) => fn(new AbortController().signal) }),
}))

vi.mock('../../lib/api', () => ({
  adminApi: { orders, createOrder: products, products },
  api: {},
}))

const AdminOrders = (await import('./Orders')).default

const order = (overrides = {}) => ({
  id: 3,
  reference: 'CP-2609-4821',
  locale: 'fr',
  customer: {
    name: 'Amina Benali',
    phone: '06 12 34 56 78',
    ...overrides.customer,
  },
  shipping: { city: 'Casablanca', address: '12 rue Ibn Batouta', notes: null },
  status: 'new',
  status_label: 'Nouvelle',
  status_color: 'amber',
  payment_method: 'cod',
  payment_method_label: 'COD',
  payment_status: 'pending',
  total: 925,
  currency: 'MAD',
  created_at: '2026-10-20T10:00:00+00:00',
  items: [],
  ...overrides,
})

/** Load the panel with one order, and wait out the 250ms list debounce. */
const renderWith = async (payload) => {
  orders.mockResolvedValue(payload)

  const render = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminOrders />
        </MemoryRouter>,
      )
    })
  }

  await render()
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300))
  })
}

let container
let root

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

describe('AdminOrders contact button', () => {
  it('opens the customer chat from the wa.me link the server built', async () => {
    await renderWith({
      data: [
        order({
          customer: {
            name: 'Amina Benali',
            phone: '06 12 34 56 78',
            // Built by OrderResource: a number typed with spaces and
            // separators arrives here already reduced to wa.me's form.
            whatsapp_url: 'https://wa.me/212612345678',
          },
        }),
      ],
      meta: {},
    })

    const wa = container.querySelector('a[href="https://wa.me/212612345678"]')
    expect(wa).toBeTruthy()
    expect(wa.textContent).toContain('contactWhatsapp')

    // New tab, so reaching for the chat does not throw away the page the
    // owner was reading; `noreferrer` keeps the target from learning the
    // panel's address.
    expect(wa.target).toBe('_blank')
    expect(wa.rel).toContain('noreferrer')
  })

  it('renders nothing where the server says the number cannot dial', async () => {
    await renderWith({
      data: [order({ customer: { name: 'Amina Benali', phone: '0512345678', whatsapp_url: null } })],
      meta: {},
    })

    expect(container.querySelector('a[href*="wa.me"]')).toBeFalsy()
    // The row is still actionable the ordinary way.
    const view = [...container.querySelectorAll('a')].find((a) => a.textContent.trim() === 'view')
    expect(view).toBeTruthy()
  })
})
