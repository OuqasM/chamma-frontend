/**
 * Coming back from a product to the list you left.
 *
 * The admin list keeps its filters in the query string, which is what makes
 * them survive a refresh and be shareable. The gap this covers is the return
 * journey: opening a product to check a price dropped the search, the brand, the
 * category and the page number, so working through a filtered list meant
 * retyping the filter for every product.
 *
 * Pinned as a helper rather than through the rendered form, because the rule
 * worth protecting is *which* parameters may travel back. A regression there is
 * silent either way — the link looks the same, it just quietly resets the list.
 */
import { describe, expect, it } from 'vitest'

import { LIST_FILTER_KEYS, listReturnQuery } from './listReturn'

describe('listReturnQuery', () => {
  it('carries the search term back', () => {
    expect(listReturnQuery('?search=oud')).toBe('?search=oud')
  })

  it('carries every filter the list reads, not just the search', () => {
    // The regression: only `search` came back, so a brand or category the admin
    // had narrowed to was reset on the way out of a product.
    const query = listReturnQuery('?search=oud&brand=3&category=7&active=1&page=4')

    expect(query).toContain('search=oud')
    expect(query).toContain('brand=3')
    expect(query).toContain('category=7')
    expect(query).toContain('active=1')
    expect(query).toContain('page=4')
  })

  it('returns nothing to append when no filter was set', () => {
    // A bare "?" on the end of a URL reads as a mistake in review.
    expect(listReturnQuery('')).toBe('')
    expect(listReturnQuery('?')).toBe('')
  })

  it('drops a parameter the list does not filter on', () => {
    // Only the list's own keys travel. Handing it an unknown parameter would
    // put a query string on the URL that nothing reads, and it would then be
    // carried into the next product's link from there.
    expect(listReturnQuery('?search=oud&utm_source=newsletter')).toBe('?search=oud')
    expect(listReturnQuery('?session=abc&page=3')).toBe('?page=3')
  })

  it('escapes a search term rather than truncating the rest of the query', () => {
    // An unescaped `&` or `=` in a search would swallow the parameters after
    // it, so returning to page 1 of a brand filter would silently become
    // returning to an unfiltered page 1.
    const query = listReturnQuery('?search=oud%20%26%20musc&brand=3')

    expect(query).toContain('brand=3')
    expect(query).not.toContain('&search=oud &') // no raw separator leaked through

    // And it has to survive being parsed back.
    const round = new URLSearchParams(query)
    expect(round.get('search')).toBe('oud & musc')
    expect(round.get('brand')).toBe('3')
  })

  it('treats an empty value as a cleared filter, not a set one', () => {
    expect(listReturnQuery('?search=&brand=3')).toBe('?brand=3')
  })

  it('accepts URLSearchParams as well as a raw string', () => {
    // The component has one; a test or a future caller may have the other.
    expect(listReturnQuery(new URLSearchParams('?search=oud&page=2'))).toBe('?search=oud&page=2')
  })

  it('names exactly the keys the list filters on', () => {
    // A guard on the guard: adding a key here without adding the matching
    // control to Products.jsx would carry a filter nothing reads.
    expect(LIST_FILTER_KEYS).toEqual(['search', 'brand', 'category', 'active', 'page'])
  })
})
