// @vitest-environment jsdom
/**
 * Admin: finding a customer by their phone number.
 *
 * The number is the key to the rest of the form. The owner types it, the panel
 * asks who it belongs to, and choosing them fills in the name, the city and
 * the address — so a regular is not asked where they live again, and the
 * delivery fee follows the city that came with them.
 *
 * The behaviour worth protecting here is runtime: the number is normalised
 * *before* it is looked up (one handset, however it was written), the fields
 * are filled from the customer that was chosen, and the order leaves the panel
 * as delivered.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const orders = vi.fn(() => Promise.resolve({ data: [], meta: {} }))
const createOrder = vi.fn(() => Promise.resolve({ order: { id: 1, reference: 'CP-2609-4821' } }))
const products = vi.fn(() => Promise.resolve({ data: [] }))
const customers = vi.fn(() => Promise.resolve({ customers: [] }))

// Hoisted, and therefore the same function on every render — which is what the
// real `useApp` does with its `useCallback`. A fresh `t` each render would
// re-fire the options effect forever and the payment method would never settle.
const t = (_group, key, vars) => (vars ? `${key}:${Object.values(vars)[0]}` : key)

// Stable for the same reason. A fresh `call` on every render would restart the
// customer lookup's debounce on every render, and the search would never
// finish.
const call = (fn) => fn(new AbortController().signal)

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call }),
}))

vi.mock('../../lib/api', () => ({
  adminApi: { orders, createOrder, products, searchCustomers: customers },
  api: {
    checkoutOptions: () =>
      Promise.resolve({
        cities: [{ value: 'CASABLANCA', label: 'Casablanca', fee: 35 }],
        payment_methods: [{ code: 'cod', label: 'Paiement à la livraison' }],
        payment: { default: 'cod' },
      }),
    quote: () =>
      Promise.resolve({
        subtotal: 890,
        shipping_cost: 35,
        total: 925,
        currency: 'MAD',
      }),
  },
}))

const AdminOrders = (await import('./Orders')).default

/** A customer the shop already knows. */
const known = {
  id: 3,
  name: 'Amina Benali',
  phone: '0612345678',
  city: 'CASABLANCA',
  address: '12 rue Ibn Batouta',
}

/** The product the owner picks. */
const product = { id: 7, name: 'Oud Impérial', price: 890, stock: 10 }

let container
let root

/** The dialog's live DOM. Portalled to the body, so queried there. */
const dialog = () => document.body.querySelector('[role="dialog"]')

const click = async (element) => {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

const type = async (element, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  await act(async () => {
    // Nobody types into a field they have not clicked into first.
    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    setter.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const field = (name) => dialog().querySelector(`[name="${name}"]`)

/** Put the caret in the field, the way the owner does. */
const focus = async (element) => {
  await act(async () => {
    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  })
}

/** A button whose label contains the given text. */
const buttonWith = (text) =>
  [...dialog().querySelectorAll('button')].find((b) => b.textContent.includes(text))

/** Wait out the 250ms debounce the customer lookup waits out. */
const settle = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300))
  })
}

const open = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>,
    )
  })
  await click([...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'newOrder'))
  expect(dialog()).toBeTruthy()
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
  orders.mockClear()
  createOrder.mockClear()
  products.mockClear()
  customers.mockClear()
  customers.mockResolvedValue({ customers: [] })
  products.mockResolvedValue({ data: [product] })
})

describe('AdminOrders customer lookup', () => {
  /**
   * The dropdown is closed until the owner is in the field. A list covering
   * the form before anybody has touched anything is in the way, not a help.
   */
  it('does not open the list before the owner is in the field', async () => {
    customers.mockResolvedValue({ customers: [known] })

    await open()
    await settle()

    // The rows are loaded, so clicking into the field brings them up at once.
    expect(customers).toHaveBeenCalled()

    // But they are not on screen yet.
    expect(dialog().textContent).not.toContain('0612345678')
  })

  /**
   * The rows are the customers the shop saw most recently. A list that says
   * "type to search" says nothing, and the owner is usually recording an
   * order for somebody they have dealt with before.
   */
  it('opens with the customers the shop already knows', async () => {
    customers.mockResolvedValue({ customers: [known] })

    await open()
    await settle()
    await focus(field('phone'))
    await settle()

    // The empty term is what asks for the recent customers.
    const [, params] = customers.mock.calls[0]
    expect(params).toMatchObject({ q: '' })

    // And the row is on screen, ready to be chosen. It shows the number and
    // the city: the number is how the owner recognises the person, and the
    // city is what decides the delivery fee.
    expect(dialog().textContent).toContain('0612345678')
    expect(dialog().textContent).toContain('CASABLANCA')
  })

  /**
   * What has been typed is what the search is made with, and the server is
   * the one that reduces it — it is the only place that decides what a number
   * is.
   */
  it('looks the customer up with what has been typed', async () => {
    await open()
    await type(field('phone'), '06 12 34 56 78')
    await settle()

    expect(customers).toHaveBeenCalled()
    const [, params] = customers.mock.calls[customers.mock.calls.length - 1]
    expect(params).toMatchObject({ q: '06 12 34 56 78' })
  })

  /**
   * A number is typed from the left, so a partial one is a prefix: "0612"
   * means "somebody on 0612…".
   */
  it('searches on a partial number', async () => {
    await open()
    await type(field('phone'), '0612')
    await settle()

    const [, params] = customers.mock.calls[customers.mock.calls.length - 1]
    expect(params).toMatchObject({ q: '0612' })
  })

  /**
   * Even a number too short to narrow anything is asked for: the server
   * decides what a term can mean, and the panel does not second-guess it.
   */
  it('searches even a short number, and lets the server decide', async () => {
    await open()
    await type(field('phone'), '06')
    await settle()

    const [, params] = customers.mock.calls[customers.mock.calls.length - 1]
    expect(params).toMatchObject({ q: '06' })
  })

  /**
   * The point of the whole form: a regular should not be asked where they
   * live again.
   */
  it('fills the name, the city and the address from the customer that was chosen', async () => {
    customers.mockResolvedValue({ customers: [known] })

    await open()
    await type(field('phone'), '0612345678')
    await settle()

    // The row is found by its number: the dropdown shows the number and the
    // city, and the name is what comes *with* the customer.
    await click(buttonWith('0612345678'))

    expect(field('customer_name').value).toBe('Amina Benali')
    expect(field('city').value).toBe('CASABLANCA')
    expect(field('address').value).toBe('12 rue Ibn Batouta')
    expect(field('phone').value).toBe('0612345678')
  })

  /**
   * The delivery fee is a fact about the city, and it is known as soon as the
   * city is — what a parcel costs to deliver does not depend on what is
   * inside it. So the owner sees it before any product is picked.
   */
  it('shows the delivery fee of the city', async () => {
    customers.mockResolvedValue({ customers: [known] })

    await open()
    await type(field('phone'), '0612345678')
    await settle()
    await click(buttonWith('0612345678'))

    const totals = dialog().querySelector('dl')
    expect(totals.textContent).toContain('35')
  })

  /**
   * A number the shop has never seen is not an error: it is a customer who
   * will be recorded with the order.
   */
  it('says so when the number is nobody the shop knows', async () => {
    await open()
    await type(field('phone'), '0699999999')
    await settle()

    expect(dialog().textContent).toContain('newOrderNewCustomer')
  })

  /**
   * An order written in the panel is one that already happened, so it is
   * recorded as delivered, and delivered means the money was collected.
   */
  it('records the order as delivered and paid', async () => {
    await open()

    expect(dialog().textContent).toContain('newOrderDelivered')

    await type(field('customer_name'), 'Amina Benali')
    await type(field('phone'), '0612345678')
    await type(field('address'), '12 rue Ibn Batouta')
    await act(async () => {
      const select = field('city')
      select.value = 'CASABLANCA'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await type(field('product_search'), 'oud')
    await settle()
    await click([...dialog().querySelectorAll('li button')][0])

    await act(async () => {
      dialog().querySelector('form').requestSubmit()
    })

    const [, body] = createOrder.mock.calls[0]
    expect(body.payment_status).toBe('paid')
    expect(body.phone).toBe('0612345678')
  })

  /**
   * Fill every field the form marks required, so the browser does not block
   * the submission before React's handler ever runs.
   */
  const fillCustomer = async () => {
    await type(field('customer_name'), 'Amina Benali')
    await type(field('phone'), '0612345678')
    await type(field('address'), '12 rue Ibn Batouta')
    await act(async () => {
      const select = field('city')
      select.value = 'CASABLANCA'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  /** Search, wait out the debounce, and add the first product. */
  const addProduct = async () => {
    await type(field('product_search'), 'oud')
    await settle()
    await click([...dialog().querySelectorAll('li button')][0])
  }

  /**
   * The delivery fee follows the city: what a parcel costs to deliver is a
   * fact about where it is going. The fee the panel sends is the carrier's
   * price for that city.
   */
  it('fills the delivery fee in from the city', async () => {
    await open()

    await act(async () => {
      const select = field('city')
      select.value = 'CASABLANCA'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(field('shipping_cost').value).toBe('35')
  })

  /**
   * The owner decides what this order costs to deliver — a negotiated rate,
   * or a free delivery — and the server is told about it.
   */
  it('lets the owner change the delivery fee', async () => {
    await open()
    await fillCustomer()
    await addProduct()

    await type(field('shipping_cost'), '20')

    await act(async () => {
      dialog().querySelector('form').requestSubmit()
    })

    const [, body] = createOrder.mock.calls[0]
    expect(body.shipping_cost).toBe(20)
    // A price the owner types is the price of delivering to that city, and
    // it is kept.
    expect(body.remember_fee).toBe(true)
  })

  it('lets the owner make the delivery free', async () => {
    await open()
    await fillCustomer()
    await addProduct()

    // The "free delivery" switch. The click toggles it: the checkbox is
    // never set by hand, because the browser owns that.
    const free = [...dialog().querySelectorAll('input[type="checkbox"]')][0]
    await click(free)

    expect(free.checked).toBe(true)
    expect(field('shipping_cost').value).toBe('0')

    await act(async () => {
      dialog().querySelector('form').requestSubmit()
    })

    const [, body] = createOrder.mock.calls[0]
    expect(body.shipping_cost).toBe(0)
    // But a free delivery for one order is not a decision about every order
    // that follows, so the city's price is left alone.
    expect(body.remember_fee).toBe(false)
  })

  /**
   * The fee is the server's business unless the owner says otherwise: the
   * carrier's price, and the free-delivery threshold, are worked out there.
   */
  it('leaves the fee to the server when the owner has not touched it', async () => {
    await open()
    await fillCustomer()

    await addProduct()

    await act(async () => {
      dialog().querySelector('form').requestSubmit()
    })

    const [, body] = createOrder.mock.calls[0]
    expect(body.shipping_cost).toBeNull()
  })
})
