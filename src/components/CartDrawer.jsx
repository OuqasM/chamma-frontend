import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useDismiss, useOverlayTransition, useBodyScrollLock, DRAWER_MS } from '../lib/overlay'
import { useCheckoutForm, CheckoutFields, OrderSummary, PlaceOrderButton, CheckoutError } from './CheckoutForm'

/**
 * The checkout drawer.
 *
 * Adding to the cart slides this in from the physical left, carrying the whole
 * order form rather than just a list of items: name, phone, city, address,
 * payment method and the bank transfer steps, all of it. The point is that a
 * shopper who already knows what they want never has to reach a cart page and a
 * checkout page — one item is one form, filled in once, from wherever they were.
 *
 * `/checkout` still exists as a full page and still works — that is the same
 * form in a wider layout, linkable, and what a shopper with several items or a
 * half-filled order goes to. There is no separate cart page: it was merged into
 * this summary, because a separate cart step between "add" and "checkout" is
 * three clicks to buy one thing, and because the lines had to become editable
 * somewhere anyway once the page that held the quantity steppers was gone.
 *
 * Two decisions worth knowing about:
 *
 *  - **It slides from the physical left in both languages**, so it does not
 *    follow the reading direction the way the mobile menu does. Arabic
 *    shoppers get it on the same side every time, which is what makes it
 *    predictable; a shopper who has to work out which side it comes from has
 *    to read the screen before they can dismiss it.
 *  - **The form stays mounted once it has been opened.** The drawer needs to
 *    mount closed to animate in, but the checkout form fetches the city list
 *    and a quote — so a drawer that mounted its form on every page of the shop
 *    would cost two API requests per page view. It is mounted from the first
 *    open onwards, which also means a shopper who closes it to check something
 *    and comes back has not lost the half of the form they filled in.
 */
export default function CartDrawer() {
  const { cartOpen, closeCart, t, locale } = useApp()
  const location = useLocation()
  const panelRef = useRef(null)

  const refs = useRef([])
  refs.current = [panelRef]
  useDismiss(refs, cartOpen, closeCart)

  // The panel stays mounted for the length of the exit transition, and only
  // reaches its open position a frame after mounting, so it slides rather than
  // appearing.
  const { mounted, shown } = useOverlayTransition(cartOpen, DRAWER_MS)
  useBodyScrollLock(cartOpen && mounted)

  // Any navigation closes it. Placing an order navigates to the receipt, and a
  // drawer left hanging over that page would be covering the confirmation.
  useEffect(() => {
    closeCart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Move focus into the panel when it opens, and hand it back to whatever had
  // it when it closes. Without the first, a keyboard shopper tabs on from the
  // product page behind and never reaches the form; without the second, focus
  // falls to the top of the document and they lose their place entirely.
  //
  // Three effects rather than one, because the panel does not exist yet on the
  // render where `cartOpen` flips: the transition mounts it a tick later. A
  // single effect would run while `panelRef.current` was still null, the focus
  // call would be a no-op, and nothing would report it.
  const openerRef = useRef(null)

  // What had focus when it started to open. Recorded before the panel steals it.
  useEffect(() => {
    if (!cartOpen) return
    const active = document.activeElement
    // The add-to-cart button has already replaced itself with a link by the time
    // this runs — React re-renders before effects — and removing the focused
    // element drops focus onto <body>. Recording that as the opener would make
    // the restore below focus <body>, which is not focusable, so it would look
    // like it worked and leave the shopper at the top of the page.
    openerRef.current = active && active !== document.body ? active : null
  }, [cartOpen])

  // Into the panel, once it is in the document. Not deferred to the next frame:
  // deferring only widens the window where a keyboard shopper is still tabbing
  // through the page behind.
  useEffect(() => {
    if (!cartOpen || !mounted) return
    panelRef.current?.focus()
  }, [cartOpen, mounted])

  // And back to whatever it was, so a shopper who dismissed the drawer with the
  // keyboard is not dropped at the top of the document.
  useEffect(() => {
    if (cartOpen) return
    const opener = openerRef.current
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
      opener.focus()
      return
    }
    // The add-to-cart button replaces itself with a "go to cart" link the moment
    // it is pressed, so the element that opened the drawer is usually already
    // detached by the time the drawer closes. Its replacement stands in the same
    // place and is just as well a place to land — and without this, a keyboard
    // shopper who closes the drawer is dropped at the top of the document.
    document.querySelector('[data-cart-trigger]')?.focus()
  }, [cartOpen])

  // From the first open onwards, never reset: see the note above the component.
  const [everOpened, setEverOpened] = useState(false)
  useEffect(() => {
    if (cartOpen) setEverOpened(true)
  }, [cartOpen])

  // After the first open the portal stays in the document even once the panel
  // has finished sliding out, because unmounting it would take the form with
  // it. A shopper who closes the drawer to check something on the product page
  // and comes back would otherwise find the name and phone they had typed gone
  // — for a cash-on-delivery order that is the difference between finishing and
  // starting again.
  //
  // It is hidden from sight and from the tab order while closed, so nothing
  // invisible is still clickable or focusable.
  const hidden = !mounted
  if (!mounted && !everOpened) return null

  return createPortal(
    <div className={`fixed inset-0 z-50 ${hidden ? 'invisible pointer-events-none' : ''}`}>
      <button
        type="button"
        aria-label={t('common', 'close')}
        onClick={closeCart}
        data-open={shown}
        className="drawer-backdrop absolute inset-0 bg-noir/50 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        aria-hidden={hidden ? 'true' : undefined}
        tabIndex={-1}
        data-open={shown}
        className="drawer-left absolute inset-y-0 left-0 flex w-[min(30rem,100vw)] flex-col bg-ivory shadow-2xl outline-none"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-ivory px-6 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <h2 id="cart-drawer-title" className="font-serif text-lg text-noir">
            {t('checkout', 'title')}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label={t('common', 'close')}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-sm leading-none text-stone-500 transition hover:border-gold hover:text-gold"
          >
            ✕
          </button>
        </header>

        {everOpened && <CartDrawerBody closeCart={closeCart} locale={locale} />}
      </div>
    </div>,
    document.body,
  )
}

/**
 * The form, and the empty state.
 *
 * Split out so the checkout hook — and with it the two API reads — only exists
 * once the shopper has actually opened the drawer.
 */
function CartDrawerBody({ closeCart }) {
  const { cart, t, locale } = useApp()
  const scrollRef = useRef(null)

  const c = useCheckoutForm({ onPlaced: closeCart, scrollRef })

  if (cart.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-stone-500">{t('cart', 'empty')}</p>
        <Link
          to={`/${locale}/products`}
          onClick={closeCart}
          className="inline-block bg-noir px-6 py-3 text-xs uppercase tracking-widest text-white hover:bg-gold"
        >
          {t('nav', 'shop')}
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* The scroll area is the one that moves to an error: `useCheckoutForm`
          scrolls this ref, since the window does not move under a drawer. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
        <CheckoutError message={c.message} errors={c.errors} />

        <OrderSummary c={c} className="border border-stone-200 p-4" />

        <form id={c.formId} onSubmit={c.submit} noValidate className="mt-6">
          <CheckoutFields c={c} />
        </form>
      </div>

      {/* Pinned, so committing the order never requires scrolling back down
          through the form to find the button. */}
      <footer className="shrink-0 border-t border-stone-200 bg-ivory px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <PlaceOrderButton c={c} />
      </footer>
    </>
  )
}
