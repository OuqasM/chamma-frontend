/**
 * Carrying the product list's filters through a trip to a product form.
 *
 * The admin list keeps its filters in the query string, which is what makes
 * them survive a refresh and be shareable. The part that was missing is the
 * return journey: opening a product to check a price dropped the search, the
 * brand, the category and the page number, so working through a filtered list
 * meant retyping the filter for every product.
 *
 * This is a helper rather than inline JSX because the rule worth stating is
 * which parameters may travel. The list reads a known set, so only that set
 * comes back; anything else in the URL is dropped rather than handed on, which
 * stops a stray tracking or session parameter from being carried into the next
 * product's link and from there persisting across the whole visit.
 */

/** The parameters Products.jsx actually filters and paginates on. */
export const LIST_FILTER_KEYS = ['search', 'brand', 'category', 'active', 'page']

/**
 * The query string to return to, including its leading `?`, or `''` when the
 * admin had no filters set.
 *
 * @param {URLSearchParams | string} params  the list's search params
 * @returns {string}
 */
export function listReturnQuery(params) {
  const carried = new URLSearchParams()

  for (const key of LIST_FILTER_KEYS) {
    // `get` already decodes, and `set` re-encodes, so a term containing `&`,
    // `=` or a space survives the round trip instead of truncating the rest of
    // the query string.
    const value = typeof params === 'string' ? new URLSearchParams(params).get(key) : params.get(key)

    // An empty value is a filter being cleared, not a filter being set, so it
    // does not belong in the URL we come back to.
    if (value !== null && value !== '') carried.set(key, value)
  }

  const query = carried.toString()

  return query ? `?${query}` : ''
}
