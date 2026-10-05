// @vitest-environment jsdom
/**
 * The checkout drawer: adding to the cart slides the whole order form in.
 *
 * Rendered against the real `AppProvider`, the real `AddToCartButton` and the
 * real drawer rather than with a mocked context. The behaviour under test is
 * precisely the wiring between those three — the add silently doing nothing was
 * the original bug — and a mocked `useApp` would replace the very code that
 * opens the panel.
 *
 * Most of what can go wrong here is invisible until runtime: the portal target,
 * the Escape listener, the body scroll lock, and the two API reads that must
 * not happen until the shopper asks for them.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const options = {
  cities: [{ value: 'casablanca', label: 'Casablanca', delay: '2 jours' }],
  payment_methods: [{ code: 'cod', label: 'Paiement à la livraison', hint: 'En espèces' }],
  payment: { default: 'cod', bank: {} },
}

const apiMock = {
  navigation: vi.fn(() => Promise.resolve({ brands: [], categories: [], contact: null })),
  checkoutOptions: vi.fn(() => Promise.resolve(options)),
  quote: vi.fn(() => Promise.resolve({ shipping_cost: 0, total: 5000 })),
  checkout: vi.fn(() => Promise.resolve({ order: { reference: 'CH-1' }, message: 'Recorded' })),
}

// `imageUrl` is here because the order summary links a thumbnail. These
// products have no image, so it returns falsy and the thumbnail is skipped —
// which is itself worth knowing, since an undefined here would mean a broken
// <img> for every line in a cart of products uploaded without one.
vi.mock('../lib/api', () => ({ api: apiMock, imageUrl: (u) => u || '' }))

const { AppProvider } = await import('../context/AppContext')
const { default: AddToCartButton } = await import('../components/AddToCartButton')
const { default: CartDrawer } = await import('../components/CartDrawer')
const { dictionaries } = await import('../lib/i18n')

const fr = dictionaries.fr
const product = {
  id: 7,
  slug: 'oud',
  name: 'Oud Impérial',
  price: 5000,
  stock: 3,
  in_stock: true,
  url: '/products/oud',
}

const other = {
  id: 8,
  slug: 'rose',
  name: 'Rose de Nuit',
  price: 3000,
  stock: 5,
  in_stock: true,
  url: '/products/rose',
}

let container
let root
let path

function LocationProbe() {
  path = useLocation().pathname
  return null
}

const dialog = () => document.body.querySelector('[role="dialog"]')

// Closing is two stages. The panel stops being open at once, so it can slide
// away rather than blink out, and only after that slide does it go fully hidden
// — it stays in the document either way, because unmounting would throw away the
// form the shopper had already filled in.
const isOpen = () => dialog()?.getAttribute('data-open') === 'true'
const isHidden = () => dialog()?.getAttribute('aria-hidden') === 'true'

const settle = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 450))
  })
}

// The panel only reaches its open position one animation frame after mounting —
// that is what gives the slide something to travel from. jsdom schedules the
// frame but does not run it on a timer we can rely on, so opening has to wait
// for one before the panel can honestly be called open.
const nextFrame = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40))
  })
}

// The triggers, always looked for in the page rather than in the dialog: once
// the drawer has been opened the panel is still in the document, hidden or not,
// so searching it would find the form's own buttons.
//
// `AddToCartButton` becomes a "go to cart" link once its product is in the cart,
// so after adding one there is one fewer button saying `addToCart`. Selecting by
// label rather than position is what lets a test add a second, different product
// — the realistic way the drawer gets reopened.
const addButtons = () =>
  [...container.querySelectorAll('button')].filter((b) => b.textContent.trim() === fr.common.addToCart)

const addButton = () => addButtons()[0]

// The steppers and remove button, read structurally rather than by label: they
// used to live on the deleted cart page, and the point of these tests is that
// they now live here instead.
const stepper = (label) => dialog().querySelector(`button[aria-label="${label}"]`)
const qty = () => stepper('+').previousElementSibling.textContent.trim()
const removeButton = () => [...dialog().querySelectorAll('button')].find((b) => b.textContent.trim() === fr.cart.remove)

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  path = null
  Object.values(apiMock).forEach((fn) => fn.mockClear())
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.body.style.overflow = ''
})

const render = async () => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/fr/products']}>
        <AppProvider>
          <LocationProbe />
          <AddToCartButton product={product} />
          <AddToCartButton product={other} />
          <CartDrawer />
        </AppProvider>
      </MemoryRouter>,
    )
  })
}

const clickAdd = async () => {
  await act(async () => {
    addButton().click()
  })
  await nextFrame()
}

const fill = async (selector, value) => {
  const field = dialog().querySelector(selector)
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setter.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('checkout drawer', () => {
  it('stays closed and fetches nothing until something is added', async () => {
    await render()

    expect(dialog()).toBeNull()
    // The drawer is mounted for the whole shop so it can animate in. If its form
    // were mounted with it, every page view would cost the city list and a
    // quote — two requests a shopper who never checks out would never see the
    // answer to.
    expect(apiMock.checkoutOptions).not.toHaveBeenCalled()
    expect(apiMock.quote).not.toHaveBeenCalled()
  })

  it('opens on add to cart', async () => {
    await render()
    await clickAdd()

    expect(dialog()).toBeTruthy()
    expect(dialog().getAttribute('aria-modal')).toBe('true')
    expect(apiMock.checkoutOptions).toHaveBeenCalledTimes(1)
    expect(apiMock.quote).toHaveBeenCalledTimes(1)
  })

  it('carries the order form, not just a list of items', async () => {
    await render()
    await clickAdd()

    // The whole point of the drawer: name, phone, city, address and payment
    // without leaving the page. Each label comes from the real dictionary, so
    // this fails if a field is dropped from the form rather than just reworded.
    for (const key of ['name', 'phone', 'email', 'address', 'notes', 'payment']) {
      expect(dialog().textContent).toContain(fr.checkout[key])
    }
    // A `<select>` of 444 cities cannot be presented; the combobox is the point.
    expect(dialog().querySelector('select')).toBeNull()

    // The commit button lives outside the form so it can be pinned to the foot
    // of the panel, and still has to submit it.
    const place = dialog().querySelector('button[type="submit"][form]')
    expect(place).toBeTruthy()
    expect(place.getAttribute('form')).toBe(dialog().querySelector('form').id)
  })

  it('slides in from the physical left in both writing directions', async () => {
    await render()
    await clickAdd()

    const panel = dialog()
    expect(panel.className).toContain('drawer-left')
    expect(panel.className).toContain('left-0')
    // `start-0` is what puts the menu drawer on the right in Arabic. The
    // checkout drawer must not move, or a shopper has to work out which edge it
    // came from before they can dismiss it.
    expect(panel.className).not.toContain('start-0')
    expect(panel.className).not.toContain('right-0')
  })

  it('takes focus, and gives it back on close', async () => {
    await render()
    const trigger = addButton()
    trigger.focus()
    await clickAdd()

    expect(document.activeElement).toBe(dialog())

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(isOpen()).toBe(false)

    await settle()

    // A keyboard shopper who cannot get back to where they were is stranded at
    // the top of the page with the cart badge a tab away. Note *not* to the
    // button they pressed: `AddToCartButton` replaces itself with a "go to cart"
    // link on the click that opened the drawer, so that button is gone by now and
    // its replacement stands in for it.
    expect(trigger.isConnected).toBe(false)
    expect(document.activeElement).toBe(container.querySelector('[data-cart-trigger]'))
  })

  it('closes on Escape', async () => {
    await render()
    await clickAdd()
    expect(isOpen()).toBe(true)

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(isOpen()).toBe(false)

    await settle()
    expect(isHidden()).toBe(true)
  })

  it('closes on a click outside the panel, and not on one inside it', async () => {
    await render()
    await clickAdd()

    // A press that lands on the panel is not a dismissal. Getting this wrong
    // closes the drawer on every quantity stepper press inside it.
    await act(async () => {
      dialog().querySelector('input[autocomplete="name"]').dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true }),
      )
    })
    expect(isOpen()).toBe(true)

    await act(async () => {
      // The backdrop is a sibling of the panel inside the portal, not part of
      // it — which is what lets a press on it count as outside.
      document.body.querySelector('.drawer-backdrop').click()
    })
    expect(isOpen()).toBe(false)
  })

  it('locks the page behind it and lets go afterwards', async () => {
    await render()
    await clickAdd()
    expect(document.body.style.overflow).toBe('hidden')

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    await settle()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  // The cart page was merged into this summary, which left one thing
  // unanswerable: where does a shopper change a quantity now that the page
  // holding the steppers is gone? These pin the answer to "here", and pin that
  // the drawer does not close underneath them when they use it.
  it('edits a line quantity in place', async () => {
    await render()
    await clickAdd()

    expect(qty()).toBe('1')

    await act(async () => {
      stepper('+').click()
    })
    expect(qty()).toBe('2')

    // The total is server-computed, so a changed quantity has to be re-quoted
    // or the shopper changes the order and pays for the old one.
    await nextFrame()
    expect(apiMock.quote).toHaveBeenCalledTimes(2)
    expect(isOpen()).toBe(true)
  })

  it('removes a line without closing the drawer', async () => {
    await render()
    await clickAdd()

    expect(dialog().textContent).toContain('Oud Impérial')

    await act(async () => {
      removeButton().click()
    })

    expect(dialog().textContent).not.toContain('Oud Impérial')
    // Removing the last line empties the drawer, which is not something to do
    // to someone halfway through typing their address.
    expect(isOpen()).toBe(true)
  })

  it('will not add a line past its stock', async () => {
    await render()
    await clickAdd()

    await act(async () => {
      stepper('+').click()
    })
    await act(async () => {
      stepper('+').click()
    })

    expect(qty()).toBe('3')
    expect(stepper('+').disabled).toBe(true)
  })

  it('sends the shopper to checkout, which is the only page left', async () => {
    await render()
    await clickAdd()

    // The button replaces itself with this link, and it used to point at a page
    // that no longer exists.
    expect(container.querySelector('[data-cart-trigger]').getAttribute('href')).toBe('/fr/checkout')
  })

  it('places the order and goes to the receipt', async () => {
    await render()
    await clickAdd()

    await fill('input[autocomplete="name"]', 'Amina Benali')
    await fill('input[autocomplete="tel"]', '0612345678')

    await act(async () => {
      dialog().querySelector('form').requestSubmit()
    })

    expect(apiMock.checkout).toHaveBeenCalledWith('fr', {
      name: 'Amina Benali',
      phone: '0612345678',
      email: '',
      city: '',
      address: '',
      notes: '',
      payment_method: 'cod',
      items: [{ product_id: 7, quantity: 1 }],
      locale: 'fr',
    })
    expect(path).toBe('/fr/order/CH-1')
  })

  it('keeps what was already filled in when it is reopened', async () => {
    await render()
    await clickAdd()
    await fill('input[autocomplete="name"]', 'Amina Benali')

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    await settle()

    // Adding a second, different product: the realistic way back in.
    await act(async () => {
      addButtons()[0].click()
    })
    await nextFrame()

    expect(dialog().querySelector('input[autocomplete="name"]').value).toBe('Amina Benali')
    // Both products are in the order now, and remounting the form to show it
    // would have cost two more requests.
    expect(apiMock.checkoutOptions).toHaveBeenCalledTimes(1)
    expect(dialog().textContent).toContain(product.name)
    expect(dialog().textContent).toContain(other.name)
  })
})
