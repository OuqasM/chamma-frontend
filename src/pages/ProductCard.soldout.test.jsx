// @vitest-environment jsdom
/**
 * Product card: the sold-out "notify me" path.
 *
 * Rendered into a real DOM rather than static markup because the things that can
 * go wrong here are all runtime ones: the portal target, the Escape listener,
 * and the dialog being inside the grid cell at all.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Tells React 18 it is under test control, so act() is not a no-op and state
// updates are flushed deterministically instead of warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const joinWaitlist = vi.fn(() => Promise.resolve({ waitlist: { created: true } }))

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'fr',
    t: (_group, key) => key,
    toggleWishlist: () => {},
    inWishlist: () => false,
    // The in-stock test renders the real AddToCartButton, which reads the cart.
    addToCart: () => {},
    cart: [],
  }),
}))

vi.mock('../lib/api', () => ({
  api: { joinWaitlist },
  imageUrl: (u) => u || null,
  productHref: (url, locale) => `/${locale}${url}`,
}))

vi.mock('../components/Price', () => ({ Price: () => <p>price</p> }))

const { ProductCard } = await import('../components/ProductCard')

const soldOutProduct = {
  id: 7,
  slug: 'oud',
  name: 'Oud Impérial',
  url: '/products/oud',
  in_stock: false,
  discount_percent: 0,
  brand: { name: 'Chamma' },
}

let container
let root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  joinWaitlist.mockClear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

const renderCard = async (props = {}) => {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ProductCard product={soldOutProduct} {...props} />
      </MemoryRouter>,
    )
  })
}

describe('ProductCard sold-out', () => {
  it('offers a notify-me button where the add-to-cart button sits', async () => {
    await renderCard()

    const buttons = [...container.querySelectorAll('button')]
    const notify = buttons.find((b) => b.textContent.trim() === 'waitlistCta')

    expect(notify).toBeTruthy()
    // In-stock cards get add-to-cart; a sold-out card must not also offer it.
    expect(buttons.some((b) => b.textContent.includes('addToCart'))).toBe(false)
  })

  it('opens the dialog on the product page, not inline in the card', async () => {
    await renderCard()

    const notify = [...container.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'waitlistCta',
    )
    await act(async () => notify.click())

    // The dialog is portalled to <body>: an inline expansion would stretch
    // every card in the grid row, which is the whole reason for the dialog.
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(container.contains(dialog)).toBe(false)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // Names the product it is about, so the shopper is not left guessing.
    expect(dialog.getAttribute('aria-label')).toBe('Oud Impérial')
  })

  it('submits the name and the number, and shows the confirmation', async () => {
    await renderCard()
    const notify = [...container.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'waitlistCta',
    )
    await act(async () => notify.click())

    // Selected by type rather than position: the form has a name field and a
    // phone field, and a test that fills `querySelector('input')` would quietly
    // start typing the customer's name into the telephone box.
    const dialog = () => document.body.querySelector('[role="dialog"]')

    const fill = async (selector, value) => {
      const field = dialog().querySelector(selector)
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      await act(async () => {
        setter.call(field, value)
        field.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }

    await fill('input[type="text"]', 'Amina Benali')
    await fill('input[type="tel"]', '0612345678')

    await act(async () => {
      dialog().querySelector('form').requestSubmit()
    })

    expect(joinWaitlist).toHaveBeenCalledWith('fr', 'oud', {
      name: 'Amina Benali',
      phone: '0612345678',
    })
    expect(dialog().textContent).toContain('waitlistDone')
  })

  it('closes on Escape', async () => {
    await renderCard()
    const notify = [...container.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'waitlistCta',
    )
    await act(async () => notify.click())
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('locks the page behind the dialog and restores scrolling after', async () => {
    await renderCard()
    const notify = [...container.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'waitlistCta',
    )

    await act(async () => notify.click())
    expect(document.body.style.overflow).toBe('hidden')

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('offers no button at all when the card is asked not to', async () => {
    // Some listings render a bare card with no actions at all.
    await renderCard({ showAdd: false })

    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent.trim())
    expect(labels).not.toContain('waitlistCta')
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('shows no notify button on an in-stock card', async () => {
    await renderCard({ product: { ...soldOutProduct, in_stock: true } })
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent.trim())
    expect(labels).not.toContain('waitlistCta')
  })
})