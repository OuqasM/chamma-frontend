// @vitest-environment jsdom
/**
 * The checkout page's arrangement, after the summary moved to the top.
 *
 * Two things here are worth pinning because they are easy to undo by accident:
 * where the summary sits relative to the form, and how many buttons commit the
 * order.
 *
 * The button count is the interesting one. `CheckoutFields` puts its own submit
 * inside step 2 of the bank-transfer flow, on the reasoning that the button
 * which commits should sit next to the bank details that made a transfer
 * necessary. `PlaceOrderButton` is a second submit, pinned at the foot of the
 * drawer or below the form on the page. Both submit the same form id, so with a
 * transfer selected the shopper was looking at two identical buttons — which is
 * how `PlaceOrderButton` came to decide for itself whether to stand down.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const options = {
  // Shaped like the real payload: every city carries a numeric fee, and 36 of
  // the 444 also carry a transit time. Both are present here on purpose, so
  // "no delivery time is shown" is an assertion about the component rather than
  // about a fixture that never had one.
  cities: [{ value: 'casablanca', label: 'Casablanca', fee: 35, delay: '2 jours' }],
  payment_methods: [
    { code: 'cod', label: 'Paiement à la livraison', hint: 'En espèces' },
    { code: 'bank_transfer', label: 'Virement bancaire', hint: 'Virement' },
  ],
  payment: {
    default: 'cod',
    bank: { holder: 'Chamma Store', bank: 'Attijariwafa', rib: '123 456', iban: 'MA123' },
  },
}

// Mutable so the reassurance test can quote a delivery that is not free.
let quoted = { shipping_cost: 35, total: 5035 }

// Swappable so a suite can hand back a payload shaped like the wrong one.
let cities = options.cities

const apiMock = {
  navigation: vi.fn(() => Promise.resolve({ brands: [], categories: [], contact: null })),
  checkoutOptions: vi.fn(() => Promise.resolve({ ...options, cities })),
  quote: vi.fn(() => Promise.resolve(quoted)),
  checkout: vi.fn(() => Promise.resolve({ order: { reference: 'CH-1' } })),
}

vi.mock('../lib/api', () => ({ api: apiMock, imageUrl: (u) => u || '' }))

const { AppProvider } = await import('../context/AppContext')
const { default: Checkout } = await import('./Checkout')
const { formatPrice } = await import('../lib/format')
const { dictionaries } = await import('../lib/i18n')

const fr = dictionaries.fr

let container
let root

beforeEach(() => {
  localStorage.clear()
  quoted = { shipping_cost: 35, total: 5035 }
  cities = options.cities
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

// Someone arriving at checkout got there by adding something.
const seedCart = () =>
  localStorage.setItem(
    'chamma_cart',
    JSON.stringify([
      { id: 1, slug: 'oud', name: 'Oud Impérial', price: 5000, quantity: 1, stock: 3, image: null },
    ]),
  )

const render = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/fr/checkout']}>
        <AppProvider>
          <Checkout />
        </AppProvider>
      </MemoryRouter>,
    )
  })
  // The city list and the quote both land after the first paint.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })
}

const commitButtons = () => [...container.querySelectorAll('button[type="submit"]')]

// The city combobox: open it, take the first option.
const chooseCity = async () => {
  await act(async () => {
    container.querySelector('button[aria-haspopup="listbox"]').click()
  })
  await act(async () => {
    container.querySelector('li[role="option"] button').click()
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })
}

const summaryHeading = () =>
  [...container.querySelectorAll('h2')].find((h) => h.textContent.trim() === fr.checkout.orderSummary)

describe('the checkout page', () => {
  it('puts the summary above the form', async () => {
    seedCart()
    await render()

    const heading = summaryHeading()
    const form = container.querySelector('form')

    expect(heading).toBeTruthy()
    expect(form).toBeTruthy()

    // Document order rather than visual order: this keeps meaning whatever the
    // CSS does, so restyling the page cannot quietly move the summary back
    // below the form without failing here.
    expect(heading.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('offers one button that commits the order', async () => {
    seedCart()
    await render()

    expect(commitButtons()).toHaveLength(1)
  })

  it('still offers exactly one once the transfer flow brings its own', async () => {
    seedCart()
    await render()

    await act(async () => {
      container.querySelector('input[value="bank_transfer"]').click()
    })

    expect(commitButtons()).toHaveLength(1)
  })

  it('adds up before a city is chosen, like the total it sits under', async () => {
    quoted = { shipping_cost: 3000, total: 8000 }
    seedCart()
    await render()

    // No city picked yet. The total already carries the server's delivery
    // estimate, so the delivery row has to carry it too — a dash there reads as
    // nothing to pay, directly above a total that has delivery in it.
    const rows = [...container.querySelectorAll('dt')].map((dt) => [
      dt.textContent.trim(),
      dt.nextElementSibling.textContent.trim(),
    ])
    const shipping = rows.find(([label]) => label === fr.cart.shipping)

    expect(shipping).toBeTruthy()
    expect(shipping[1]).toBe(formatPrice(3000, 'fr'))
    expect(shipping[1]).not.toBe('—')
  })

  it('shows the fee for the chosen city and no delivery time', async () => {
    seedCart()
    await render()
    await chooseCity()

    const dt = [...container.querySelectorAll('dt')].find((d) => d.textContent.trim() === fr.cart.shipping)
    expect(dt.nextElementSibling.textContent.trim()).toBe(formatPrice(35, 'fr'))

    // No "2 jours" beside the fee, here or under the city field. The carrier
    // table carries a transit time for 36 of the 444 cities and none for the
    // rest, so the line read as a promise on one screen and as nothing at all
    // on the next — and the shopper had no way to tell which they were looking
    // at.
    expect(container.textContent).not.toContain('jours')
    expect(container.textContent).not.toContain(fr.checkout.citySearch)
  })

  // The bug this whole helper exists for. A `/checkout/options` response that
  // has no `fee` on its cities — an older API, a partial response, a proxy
  // rewriting the body — used to print "Offerte" beside every one of them,
  // because `undefined > 0` is false and the else-branch was "free delivery".
  // The store told the entire country its parcels were free, from a field it
  // simply had not been sent.
  it('never calls a missing fee free, in any of the three places a fee shows', async () => {
    cities = [{ value: 'casablanca', label: 'Casablanca' }]
    quoted = { total: 5000 }
    seedCart()
    await render()
    await chooseCity()

    expect(container.textContent).not.toContain(fr.common.free)
    expect(container.textContent).not.toContain(fr.checkout.freeDelivery)

    // And the option list, which had the same comparison in it.
    await act(async () => {
      container.querySelector('button[aria-haspopup="listbox"]').click()
    })
    const list = [...container.querySelectorAll('li[role="option"]')].map((li) => li.textContent).join(' ')
    expect(list).not.toContain(fr.common.free)
  })

  it('restates the total on the button that spends it', async () => {
    seedCart()
    await render()

    const total = formatPrice(quoted.total, 'fr')

    // In the summary…
    expect(container.textContent).toContain(total)
    // …and again inside the block holding the button, which is what stays on
    // screen in the drawer once the summary has scrolled away.
    expect(commitButtons()[0].parentElement.textContent).toContain(total)
  })

  it('says nothing about delivery until a city is chosen', async () => {
    quoted = { shipping_cost: 0, total: 5000 }
    seedCart()
    await render()

    // Cash on delivery is a fact about the method, so it can be said now.
    expect(commitButtons()[0].parentElement.textContent).toContain(fr.checkout.cod)

    // Free delivery is a fact about a quote that has no answer yet, so it
    // cannot be. Claiming it here and dropping it a moment later, once the
    // shopper picks a city, is telling them two things about one order.
    expect(commitButtons()[0].parentElement.textContent).not.toContain(fr.checkout.freeDelivery)

    await chooseCity()

    expect(commitButtons()[0].parentElement.textContent).toContain(fr.checkout.freeDelivery)
  })

  it('drops the free-delivery claim when the delivery costs money', async () => {
    quoted = { shipping_cost: 3000, total: 8000 }
    seedCart()
    await render()
    await chooseCity()

    expect(commitButtons()[0].parentElement.textContent).not.toContain(fr.checkout.freeDelivery)
    // And the total is the one the server quoted, not the earlier one.
    expect(commitButtons()[0].parentElement.textContent).toContain(formatPrice(8000, 'fr'))
  })
})
