import { formatPrice, discountPercent } from '../lib/format'
import { useApp } from '../context/AppContext'

export function Price({ product, className = '' }) {
  const { locale } = useApp()
  const off = discountPercent(product.price, product.compare_at_price)

  // The discount pair is tokenised rather than a literal `rose-700`, so it
  // follows the palette. It is the one place the palette uses `sale` red: a
  // price cut has to read as a price cut, and `plum` at 48% saturation read as
  // mauve trim instead. The saving and its percent are the same colour because
  // they are the same message — a red price beside a mauve pill looked like a
  // mistake rather than a pairing.
  //
  // `sale` is 5.21:1 on white, which clears AA for both roles: the 11px pill
  // text against its own fill, and the price against the page. All three
  // call sites are on light surfaces; moving this onto `bg-noir` would drop it
  // to 3.1:1 and need a lighter step.
  //
  // Every price here rides `font-price`, Oswald's condensed 600 — a price is
  // a promo surface, so it reads as a price tag, not as body copy. Wishlist's
  // call site sends no weight of its own, so the component carries the 600
  // itself rather than depending on its callers.

  if (!product.compare_at_price || off <= 0) {
    return <span className={`font-price font-semibold ${className}`}>{formatPrice(product.price, locale)}</span>
  }

  return (
    <span className={`font-price font-semibold inline-flex items-baseline gap-2 ${className}`}>
      <span className="text-sale">{formatPrice(product.price, locale)}</span>
      <s className="text-sm text-stone-400">{formatPrice(product.compare_at_price, locale)}</s>
      <span className="rounded-full bg-sale px-1.5 py-0.5 text-[11px] font-medium text-white">
        -{off}%
      </span>
    </span>
  )
}
