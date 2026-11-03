// @vitest-environment jsdom
/**
 * Admin: the articles cell on the orders list.
 *
 * The column is capped, and a line of nowrap text inside a capped cell paints
 * over the city next to it — the text read as if it were outside its own
 * border. The fix is that every part of the line is marked to stay inside it:
 * the name gives way first, the variant and the quantity keep their room.
 *
 * jsdom has no layout, so the clipping cannot be measured here; what is
 * asserted is the markup that makes it true — the name shrinks and is
 * truncated, the variant is truncated rather than allowed to run on, and the
 * full text is on the title for the hover.
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
  customer: { name: 'Amina Benali', phone: '06 12 34 56 78' },
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

let container
let root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  orders.mockClear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

/** Load the panel with one order, and wait out the 250ms list debounce. */
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

/** The articles cell of the first row. */
const articlesCell = () => {
  const cells = [...container.querySelectorAll('tbody td')]
  const cell = cells.find((c) => c.querySelector('ul'))
  return cell
}

describe('AdminOrders articles cell', () => {
  it('keeps a long name inside its own column', async () => {
    await renderWith({
      data: [
        order({
          items: [
            {
              id: 1,
              name: "Chamma Perfume Ibraq Blanc Édition Limitée 100 ml",
              variant: '100 ml',
              quantity: 2,
            },
          ],
        }),
      ],
      meta: {},
    })

    const name = articlesCell().querySelector('span[title]')

    // The name is the part that gives way: it can shrink below its own text
    // and is truncated rather than allowed to run past the cell.
    expect(name.textContent).toContain('Ibraq')
    expect(name.className).toContain('truncate')
    expect(name.className).toContain('min-w-0')
    // The whole name is still one hover away.
    expect(name.getAttribute('title')).toBe("Chamma Perfume Ibraq Blanc Édition Limitée 100 ml")
  })

  it('truncates the variant instead of letting it run on', async () => {
    await renderWith({
      data: [
        order({
          items: [{ id: 1, name: 'Ibraq', variant: 'Extrait de parfum 100 ml', quantity: 1 }],
        }),
      ],
      meta: {},
    })

    const variant = [...articlesCell().querySelectorAll('span')].find((s) => s.getAttribute('title') === 'Extrait de parfum 100 ml')

    expect(variant).toBeTruthy()
    expect(variant.className).toContain('truncate')
    expect(variant.className).toContain('shrink-0')
    expect(variant.textContent).toContain('Extrait de parfum 100 ml')
  })

  it('keeps the quantity whole — it decides how many bottles leave', async () => {
    await renderWith({
      data: [order({ items: [{ id: 1, name: 'Ibraq', variant: '50 ml', quantity: 12 }] })],
      meta: {},
    })

    const quantity = [...articlesCell().querySelectorAll('span')].find((s) => s.textContent === '×12')

    expect(quantity).toBeTruthy()
    expect(quantity.className).toContain('shrink-0')
  })

  it('says nothing where an order has no articles', async () => {
    await renderWith({ data: [order({ items: [] })], meta: {} })

    expect(articlesCell().textContent.trim()).toBe('—')
  })
})
