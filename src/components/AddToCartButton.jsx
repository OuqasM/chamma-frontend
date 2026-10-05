import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

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
  ...props
}) {
  const { locale, t, addToCart, cart } = useApp()

  const inCart = cart.some((l) => l.id === product.id)

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
        addToCart(product, quantity)
        onAdd?.()
      }}
      className={className}
      {...props}
    >
      {children ?? t('common', 'addToCart')}
    </button>
  )
}