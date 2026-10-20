/**
 * The scroll the router cannot see.
 *
 * `ScrollToTop` in App.jsx owns the scroll for genuine route changes. Two
 * kinds of navigation never reach it, and they are the two that make a page
 * "start from the bottom":
 *
 * - The catalogue's pagination and sorting ride the query string on the same
 *   pathname, and `ScrollToTop` must not key on the query string because the
 *   filter chips use the same channel to edit the list in place. `Catalogue`
 *   watches its own `page`/`sort` instead.
 * - A link aimed at the location the shopper already occupies. React Router
 *   flattens that into nothing — no push, no history entry, no new location —
 *   so there is nothing for any router subscriber to observe. `scrollIfSelf`
 *   is the click-time answer: when a link's destination equals the current
 *   `pathname` + `search`, clicking it scrolls to the top, because a click is
 *   a request to *be* on that page, and being on a page means starting at it.
 *
 * The `instant` behaviour matches `ScrollToTop`: a tween between pages reads
 * as lag, not polish. `left: 0` too, since a sideways-scrolled page carries
 * that offset the same way.
 */

/**
 * A click handler factory for `Link`/`NavLink`/`<a>` whose destination may be
 * the page the shopper is already on. Compose it with the element's other
 * handlers; it returns nothing when the destination differs, so real
 * navigations are left to `ScrollToTop`.
 *
 * @param {string} to        the link's `to`/`href`, absolute or relative
 * @param {object} location  the current `useLocation()` value
 */
export function scrollIfSelf(to, location) {
  return () => {
    const dest = new URL(to, window.location.origin)
    if (dest.origin === window.location.origin && dest.pathname === location.pathname && dest.search === location.search) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }
}

export const INSTANT_SCROLL = { top: 0, left: 0, behavior: 'instant' }
