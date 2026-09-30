import { formatPrice, discountPercent } from '../lib/format'
import { useApp } from '../context/AppContext'

export function Price({ product, className = '' }) {
  const { locale } = useApp()
  const off = discountPercent(product.price, product.compare_at_price)

  // The discount pair is tokenised rather than a literal `rose-700`, so it
  // follows the palette. `plum` keeps the relationship the default red had to
  // the old accent: a deeper tone than `gold`, so the saving still reads as a
  // separate signal instead of competing with the brand colour.

  if (!product.compare_at_price || off <= 0) {
    return <span className={className}>{formatPrice(product.price, locale)}</span>
  }

  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className="text-plum">{formatPrice(product.price, locale)}</span>
      <s className="text-sm text-stone-400">{formatPrice(product.compare_at_price, locale)}</s>
      <span className="rounded-full bg-plum px-1.5 py-0.5 text-[11px] font-medium text-white">
        -{off}%
      </span>
    </span>
  )
}
