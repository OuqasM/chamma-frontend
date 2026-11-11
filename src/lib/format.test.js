/**
 * The money formatter.
 *
 * A price the owner typed as 89,90 has to read as 89,90: rounding the
 * numbers after the dot away is how a total stops adding up to its lines —
 * in the cart, at the checkout, and in the panel where the purchase prices
 * the benefit is worked out from are read. A whole amount keeps the clean
 * form the shop has always shown.
 */
import { describe, expect, it } from 'vitest'
import { formatPrice } from './format'

describe('formatPrice', () => {
  it('keeps a whole amount clean', () => {
    expect(formatPrice(890, 'fr')).toBe('890 MAD')
    expect(formatPrice('890', 'fr')).toBe('890 MAD')
    expect(formatPrice(0, 'fr')).toBe('0 MAD')
  })

  it('shows the centimes of an amount that carries them', () => {
    expect(formatPrice('89.9', 'fr')).toBe('89,90 MAD')
    expect(formatPrice(179.8, 'fr')).toBe('179,80 MAD')
    expect(formatPrice('534.75', 'fr')).toBe('534,75 MAD')
  })

  it('rounds a figure to its two decimals rather than hiding the dust', () => {
    // Float arithmetic on prices leaves dust: the formatter treats
    // 179.99999999997 as the 180,00 it is, not as a figure with centimes.
    expect(formatPrice(179.79999999999998, 'fr')).toBe('179,80 MAD')
    expect(formatPrice(179.9999999999, 'fr')).toBe('180 MAD')
  })

  it('formats in the locale it is asked for', () => {
    expect(formatPrice('89.9', 'en')).toBe('89.90 MAD')
  })
})
