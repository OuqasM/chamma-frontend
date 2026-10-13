import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { productHref } from '../lib/api'

/**
 * Add to cart, which becomes a link to the cart once the product is in it.
 *
 * One button that turns into another rather than two buttons appearing. After
 * adding, the thing the shopper most likely wants next is the cart, and the
 * position they just pressed is where they will look for it — a cart button
 * that appears beside it competes with the header's, and a second button makes
 * the card taller and breaks the grid alignment the price row depends on.
 *
 * The state is derived from the cart itself rather than from a local flag: once
 * the product is in the cart, reaching it *is* the useful action, including
 * after a reload or from a page where they added it in another tab.
 */
export default function AddToCartButton({
  product,
  quantity = 1,
  className = '',
  activeClassName = '',
  activeIconClassName = '',
  onAdd,
  children,
  disabled = false,
  type = 'button',
  // Pulled out of the spread below so they never reach the DOM element, and
  // normalised into one list either way.
  variant,
  variants,
  ...props
}) {
  const { locale, t, addToCart, cart } = useApp()

  // The product page lets a shopper pick several variants at once, so the
  // selection is a list. The older single `variant` prop still works — it is
  // just a list of one — and no selection at all stays an empty list, which is
  // what a product without variants has.
  const chosen = Array.isArray(variants) ? variants.filter(Boolean) : variant ? [variant] : []

  // Keyed by variant too, so a product already sitting in the cart in one size
  // does not block adding a different one from the product page. With several
  // selections the button only reads "in the cart" once every one of them is.
  const inCart =
    chosen.length > 0
      ? chosen.every((v) => cart.some((l) => l.id === product.id && (l.variant || '') === v))
      : cart.some((l) => l.id === product.id && (l.variant || '') === '')

  // A variant is mandatory: a product that has variants can never be added
  // without one. On the product page the caller disables the button until the
  // shopper chooses (and the selector is right above it). On a listing card
  // there is no selector, so the button becomes a link to the product page,
  // where the choice can actually be made.
  const needsVariant = Boolean(product?.has_variants) && chosen.length === 0

  if (needsVariant && !disabled) {
    return (
      <Link
        to={productHref(product.url, locale)}
        className={`flex items-center justify-center text-center ${className} ${activeClassName}`}
        {...props}
      >
        {children ?? t('product', 'selectVariant')}
      </Link>
    )
  }

  if (inCart) {
    return (
      <Link
        // Stands in for the button that opened the checkout drawer: the button
        // is replaced by this link the moment it is pressed, so by the time the
        // drawer closes the element that opened it no longer exists. The drawer
        // hands focus here instead — see its focus effects.
        data-cart-trigger
        to={`/${locale}/checkout`}
        // A link is inline, so the w-full every caller passes would be ignored
        // and the label would sit hard against the start edge. Forcing the
        // block-level box the button had keeps the label centred and the
        // footprint identical to what the shopper just pressed.
        className={`flex items-center justify-center text-center ${className} ${activeClassName}`}
        {...props}
      >
        {t('common', 'goToCart')}
        {/* Points somewhere, so it should look like it does. The arrow flips
            with the reading direction rather than pointing backwards in Arabic. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className={`ms-2 h-3.5 w-3.5 rtl:-scale-x-100 ${activeIconClassName}`}
        >
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    )
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={() => {
        if (product?.has_variants && chosen.length === 0) return
        // One cart line per chosen variant, so picking two sizes adds both.
        if (chosen.length > 0) {
          chosen.forEach((v) => addToCart(product, quantity, v))
        } else {
          addToCart(product, quantity, null)
        }
        onAdd?.()
      }}
      className={className}
      {...props}
    >
      {children ?? (needsVariant ? t('product', 'selectVariant') : t('common', 'addToCart'))}
    </button>
  )
}