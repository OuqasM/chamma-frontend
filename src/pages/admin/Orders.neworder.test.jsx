// @vitest-environment jsdom
/**
 * Admin: recording an order the owner took on the phone.
 *
 * Rendered into a real DOM rather than static markup, because the behaviour
 * worth protecting here is all runtime: the debounced product search, merging a
 * repeated add into a quantity, and exactly which fields leave the browser.
 *
 * That last one is the important one. The server re-reads prices and stock, so
 * the only thing this form is allowed to send is which product, how many, and
 * who the customer is. If a display field ever leaks into the payload the
 * server is being told a price it should have looked up itself.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const orders = vi.fn(() => Promise.resolve({ data: [], meta: {} }))
const createOrder = vi.fn(() => Promise.resolve({ order: { id: 1, reference: 'CP-2609-4821' } }))
const products = vi.fn(() => Promise.resolve({ data: [] }))

// Hoisted, and therefore the same function on every render — which is what the
// real `useApp` does with its `useCallback`. A fresh `t` each render would
// re-fire the options effect forever and the payment method would never settle.
const t = (_group, key, vars) => (vars ? `${key}:${Object.values(vars)[0]}` : key)

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call: (fn) => fn(new AbortController().signal) }),
}))

vi.mock('../../lib/api', () => ({
  adminApi: { orders, createOrder, products },
  api: {
    checkoutOptions: () =>
      Promise.resolve({
        cities: [{ value: 'CASABLANCA', label: 'Casablanca', fee: 35 }],
        payment_methods: [{ code: 'cod', label: 'Paiement à la livraison' }],
        payment: { default: 'cod' },
      }),
  },
}))

const AdminOrders = (await import('./Orders')).default

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
  const proto = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
  await act(async () => {
    setter.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const button = (label) => [...dialog().querySelectorAll('button')].find((b) => b.textContent.trim() === label)

const field = (name) => dialog().querySelector(`[name="${name}"]`)

const choose = async (element, value) => {
  await act(async () => {
    element.value = value
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

/**
 * Fill every field the form marks required.
 *
 * City matters as much as the text inputs here: it is `required`, and the
 * browser blocks submission on an invalid form before React's handler ever runs,
 * so a test that leaves it on the placeholder silently asserts nothing.
 */
const fillCustomer = async () => {
  await type(field('customer_name'), 'Amina Benali')
  await type(field('phone'), '0612345678')
  await type(field('address'), '12 rue Ibn Batouta')
  await choose(field('city'), 'CASABLANCA')
}

/** Search, wait out the 250ms debounce, and add the first match. */
const addProduct = async () => {
  await type(field('product_search'), 'oud')
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300))
  })
  await click([...dialog().querySelectorAll('li button')][0])
}

const open = async () => {
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
  await click([...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'newOrder'))
  expect(dialog()).toBeTruthy()
}

// Every test leaves a portal target and a React root behind. Without this the
// next test's `document.body` still holds the previous dialog, and a helper that
// reaches for `document.body` finds a component nobody is interacting with any
// more — which fails as a confusing assertion rather than as a stale test.
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
  createOrder.mockResolvedValue({ order: { id: 1, reference: 'CP-2609-4821' } })
  products.mockResolvedValue({ data: [product] })
})

describe('AdminOrders new order', () => {
  /**
   * Two regressions in one place, because they are the same shape of mistake:
   * the form quietly sending something it should not, or failing to send
   * something it should.
   *
   * `payment_method: 'cod'` is the second. It is defaulted from the server's
   * config once the options load, and the payment <select> has no placeholder
   * option — so when that default silently failed to apply, the DOM still showed
   * "cod" while React's state held "", the owner saw a correct-looking form, and
   * every single save came back 422.
   */
  it('sends only the fields the server needs, never a price from the panel', async () => {
    await open()
    await fillCustomer()
    await addProduct()

    await act(async () => {
      dialog().querySelector('form').requestSubmit()
    })

    expect(createOrder).toHaveBeenCalledTimes(1)
    const [, body] = createOrder.mock.calls[0]


    expect(body).toMatchObject({
      name: 'Amina Benali',
      phone: '0612345678',
      address: '12 rue Ibn Batouta',
      payment_method: 'cod',
      items: [{ product_id: 7, quantity: 1 }],
    })

    // The rows carry `price` and `stock` so the owner can see them. None of that
    // may travel: OrderService re-reads both from the database, and a request
    // that carried its own price would be a way to charge whatever was typed.
    expect(JSON.stringify(body)).not.toContain('890')
    expect(body.items[0]).not.toHaveProperty('price')
    expect(body.items[0]).not.toHaveProperty('stock')
    expect(body.items[0]).not.toHaveProperty('name')
  })

  it('raises the quantity when the same product is added twice', async () => {
    await open()
    await fillCustomer()
    await addProduct()
    await addProduct()

    await act(async () => {
      dialog().querySelector('form').requestSubmit()
    })

    const [, body] = createOrder.mock.calls[0]
    // One row with a quantity of 2, not two rows of 1. Two rows would still add
    // up at checkout, but they read as two separate decisions and have to be
    // reconciled by hand when the total is wrong.
    expect(body.items).toEqual([{ product_id: 7, quantity: 2 }])
  })

  it('will not submit an order with no items', async () => {
    await open()
    await fillCustomer()

    const save = [...container.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'save',
    )
    expect(save.disabled).toBe(true)
  })

  it('shows the reason the server refused, instead of a generic failure', async () => {
    // 422 carries the real cause — sold out, city not served, name blank. A
    // generic "something went wrong" would hide the one line the owner needs.
    createOrder.mockRejectedValue(new Error('Stock insuffisant pour :product.'))

    await open()
    await fillCustomer()
    await addProduct()

    await act(async () => {
      dialog().querySelector('form').requestSubmit()
    })

    expect(dialog().textContent).toContain('Stock insuffisant')
    // And the form is still there, with what was typed, rather than cleared.
    expect(dialog().textContent).toContain('newOrderTitle')
  })

  it('closes without recording anything when cancelled', async () => {
    await open()
    await click(button('cancel'))

    expect(dialog()).toBeFalsy()
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('offers the cities the carrier actually delivers to', async () => {
    // Same options source as checkout, so the panel cannot offer a city that
    // checkout would then reject.
    await open()

    const options = [...dialog().querySelectorAll('select')][0]
    expect([...options.querySelectorAll('option')].map((o) => o.value)).toContain('CASABLANCA')
  })
})