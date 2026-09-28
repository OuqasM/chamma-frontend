import { formatPrice, discountPercent } from '../lib/format'
import { useApp } from '../context/AppContext'

export function Price({ product, className = '' }) {
  const { locale } = useApp()
  const off = discountPercent(product.price, product.compare_at_price)

  if (!product.compare_at_price || off <= 0) {
    return <span className={className}>{formatPrice(product.price, locale)}</span>
  }

  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className="text-rose-700">{formatPrice(product.price, locale)}</span>
      <s className="text-sm text-stone-400">{formatPrice(product.compare_at_price, locale)}</s>
      <span className="rounded-full bg-rose-700 px-1.5 py-0.5 text-[11px] font-medium text-white">
        -{off}%
      </span>
    </span>
  )
}
