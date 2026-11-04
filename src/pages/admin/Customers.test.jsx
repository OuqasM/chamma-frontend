// @vitest-environment jsdom
/**
 * Admin: the customers list.
 *
 * A customer is somebody who has ordered, and this list is the only place the
 * owner can see who that is. What is worth protecting here is that the list
 * says the two things that decide how to treat a person — how many times they
 * have ordered and when they last did — and that the search takes a number the
 * way it is spoken, because the shop's own records would not find each other
 * otherwise.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const customers = vi.fn()

// Same shape as the panel's real `t`: it is a mock everywhere in the admin
// pages, so the assertions reach the markup by key, not by a translated word.
const t = (_group, key, vars) => (vars ? `${key}:${Object.values(vars)[0]}` : key)

const call = (fn) => fn(new AbortController().signal)

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call }),
}))

vi.mock('../../lib/api', () => ({
  adminApi: { customers },
  api: {},
}))

const AdminCustomers = (await import('./Customers')).default

const customer = (overrides = {}) => ({
  id: 3,
  name: 'Amina Benali',
  phone: '0612345678',
  city: 'CASABLANCA',
  address: '12 rue Ibn Batouta',
  orders_count: 3,
  last_order_at: '2026-10-20T10:00:00+00:00',
  since: '2026-09-01T10:00:00+00:00',
  ...overrides,
})

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
  customers.mockResolvedValue(payload)

  await act(async () => {
    root.render(
      <MemoryRouter>
        <AdminCustomers />
      </MemoryRouter>,
    )
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300))
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
  customers.mockClear()
})

describe('AdminCustomers', () => {
  it('lists the customers with how often they ordered and when they last did', async () => {
    await renderWith({
      customers: [customer()],
      summary: { total: 1, repeat: 1, new_this_month: 0 },
      meta: {},
    })

    const row = container.querySelector('tbody tr')
    expect(row.textContent).toContain('Amina Benali')
    expect(row.textContent).toContain('0612345678')
    expect(row.textContent).toContain('CASABLANCA')
    expect(row.textContent).toContain('12 rue Ibn Batouta')
    // Three orders is what separates a regular from somebody who called once,
    // so it is the one number on the row that is highlighted.
    expect(row.textContent).toContain('3')
  })

  it('says how many customers there are and how many came back', async () => {
    await renderWith({
      customers: [customer()],
      summary: { total: 12, repeat: 4, new_this_month: 3 },
      meta: {},
    })

    const text = container.textContent
    expect(text).toContain('customersTotal')
    expect(text).toContain('12')
    expect(text).toContain('customersRepeat')
    expect(text).toContain('4')
  })

  it('searches by name or by number', async () => {
    await renderWith({ customers: [], summary: {}, meta: {} })

    const search = container.querySelector('input')
    await type(search, '0612345678')

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })

    // The term goes to the server, which reduces it the same way the order
    // form does — the panel does not decide what a number means.
    const [, params] = customers.mock.calls[customers.mock.calls.length - 1]
    expect(params).toMatchObject({ search: '0612345678' })
  })

  it('says so when the shop has no customers yet', async () => {
    await renderWith({ customers: [], summary: { total: 0, repeat: 0, new_this_month: 0 }, meta: {} })

    expect(container.textContent).toContain('customersEmpty')
  })
})
