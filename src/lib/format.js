export function formatPrice(value, locale = 'fr') {
  const amount = Number(value || 0)
  // The numbers after the dot are part of the price: a purchase price of
  // 534,75 or a total of 179,80 that displayed itself as 535 or 180 is how a
  // total stops adding up to its lines. So an amount that carries centimes
  // shows them, exactly; a whole amount keeps the clean form the shop has
  // always shown. The rounding first keeps float dust from reading as
  // centimes (0.30000000000004 is a rounding artefact, not 30 centimes).
  const clean = Math.round(amount * 100) / 100
  const hasCentimes = clean % 1 !== 0
  const tag = { fr: 'fr-MA', ar: 'ar-MA', en: 'en-MA' }[locale] || 'fr-MA'
  try {
    return (
      new Intl.NumberFormat(tag, {
        minimumFractionDigits: hasCentimes ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(clean) + ' MAD'
    )
  } catch {
    return `${clean} MAD`
  }
}

export function discountPercent(price, compareAt) {
  const p = Number(price)
  const c = Number(compareAt)
  if (!c || c <= p) return 0
  return Math.round(((c - p) / c) * 100)
}
