export function formatPrice(value, locale = 'fr') {
  const amount = Number(value || 0)
  const tag = { fr: 'fr-MA', ar: 'ar-MA', en: 'en-MA' }[locale] || 'fr-MA'
  try {
    return new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(amount) + ' MAD'
  } catch {
    return `${amount} MAD`
  }
}

export function discountPercent(price, compareAt) {
  const p = Number(price)
  const c = Number(compareAt)
  if (!c || c <= p) return 0
  return Math.round(((c - p) / c) * 100)
}
