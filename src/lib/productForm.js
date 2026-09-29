/**
 * The product form's shape, in one place.
 *
 * "Duplicate" is started from the products list and finishes on the creation
 * form, so two pages have to agree on what a pre-filled form looks like. They
 * used to build it independently; if they drift, a duplicate silently loses
 * whatever the two versions disagree about. Both now read it from here.
 */

import { LOCALES } from './i18n'

/** The languages copy can be written in; mirrors config('chamma.locales'). */
export const COPY_LOCALES = LOCALES

/** Copy for every language, all empty. */
export const emptyCopy = () => Object.fromEntries(COPY_LOCALES.map((code) => [code, '']))

/**
 * Copy per language, read from a product's translation rows.
 *
 * A row that is missing, or for a language the shop does not sell in, reads as
 * empty rather than failing — which is what a product created before copy was
 * per-language looks like.
 */
export const copyFromTranslations = (rows, field) => {
  const out = emptyCopy()

  ;(rows || []).forEach((row) => {
    if (COPY_LOCALES.includes(row.locale) && typeof row[field] === 'string') out[row.locale] = row[field]
  })

  return out
}

/**
 * The form state handed to the creation form by "duplicate".
 *
 * Nothing is written: the merchant adjusts what was carried over before
 * anything reaches the API.
 *
 * The slug is left out because the API derives it from the name, and the
 * photos are left out because the image rows point at files this product owns
 * — handing the same paths to a second product would make removing a photo
 * from either one delete it for both.
 */
export const prefillFromProduct = (product) => ({
  name: product.name || '',
  brand_id: product.brand_id ?? '',
  category_id: product.category_id ?? '',
  // The form edits the full price; when discounted that is the struck
  // original, not the discounted amount the customer is charged.
  price: (product.discount_percent ?? 0) > 0 ? (product.compare_at_price ?? product.price) : (product.price ?? ''),
  cost_price: product.cost_price ?? '',
  // UI-only: never sent as-is, converted to compare_at_price on submit.
  discount: product.discount_percent ?? '',
  // The publish flag and the availability flag are separate, and the duplicate
  // starts as a plain live product: the merchant sets what it should be.
  is_active: true,
  is_available: true,
  stock: 100,
  gender: product.gender || '',
  is_new: Boolean(product.is_new),
  short_descriptions: copyFromTranslations(product.translations, 'short_description'),
  descriptions: copyFromTranslations(product.translations, 'description'),
})
