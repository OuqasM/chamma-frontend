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
        to={`/${locale}/cart`}
        className={`${className} ${activeClassName}`}
        {...props}
      >
        {t('common', 'goToCart')}
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