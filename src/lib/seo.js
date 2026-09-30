/**
 * Page metadata for crawlers and link previews.
 *
 * The storefront is a client-rendered SPA, so index.html can only ever carry a
 * generic title. Everything specific to a page — the product name, the
 * description the admin typed, the canonical URL, which languages this page
 * exists in — arrives with the data and has to be written into <head> here.
 *
 * Two constraints shape the implementation:
 *
 *   Tags are created or updated one at a time, never by rewriting <head>. A
 *   blanket assignment would take charset, viewport and theme-color with it,
 *   and the failure would be a blank page rather than a missing title.
 *
 *   Every tag this module owns is tracked, so a page that sets a description
 *   and a later page that sets none do not leave the previous page's string
 *   behind. That staleness is how a sitemap gets indexed with the wrong text.
 */

/** Tags created by setMeta/setLink, so a later page can reset them. */
const owned = new Map()

function upsert(head, kind, key, attrs, content) {
  const selector = `${kind}[${key}="${attrs[key]}"]`
  let el = head.querySelector(selector)

  if (!el) {
    el = document.createElement(kind)
    el.setAttribute(key, attrs[key])
    head.appendChild(el)
    owned.set(`${kind}:${attrs[key]}`, el)
  }

  for (const [name, value] of Object.entries(attrs)) {
    if (name !== key) el.setAttribute(name, value)
  }

  el.textContent = content ?? ''

  return el
}

export const setTitle = (value) => {
  document.title = value
}

export const setMeta = (name, content) => {
  if (content === null || content === undefined || content === '') return
  upsert(document.head, 'meta', 'name', { name }, content)
}

/**
 * Removed rather than emptied. An empty og:description is worse than none: some
 * scrapers show the blank string, and some fall back to text on the page that
 * was never meant to be a summary.
 */
export const setMetaOrRemove = (name, content) => {
  if (content) {
    setMeta(name, content)
    return
  }

  const el = document.head.querySelector(`meta[name="${name}"]`)
  if (el) el.remove()
}

export const setLink = (rel, href) => {
  const el = document.head.querySelector(`link[rel="${rel}"]:not([hreflang])`)
  if (!el) return
  el.setAttribute('href', href)
}

export const ensureLink = (rel, attrs) => {
  const sel = `link[${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join('][')}]`
  let el = document.head.querySelector(sel)
  if (!el) {
    el = document.createElement('link')
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    document.head.appendChild(el)
  }
  return el
}

/**
 * One link per rel, updated in place rather than matched on its own attributes.
 *
 * ensureLink finds a tag by every attribute it is given, which is fine for the
 * hreflang set because those are removed and rebuilt each time, and wrong for
 * anything whose href changes: matching on `href` means the second page fails
 * to find the first page's tag and appends a second one. A document with two
 * canonicals is treated as conflicting, and the one left over names a product
 * the visitor is no longer on.
 */
const upsertLink = (rel, attrs) => {
  const el = document.head.querySelector(`link[rel="${rel}"]:not([hreflang])`)
    ?? document.createElement('link')
  el.setAttribute('rel', rel)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  if (!el.parentNode) document.head.appendChild(el)
  return el
}

/**
 * Writes canonical and hreflang.
 *
 * The canonical is what stops the three locales competing: without it, /fr/,
 * /ar/ and /en/ of one product are three URLs for one page and Google keeps
 * whichever it saw first, discarding the other two.
 *
 * `alternates` comes from the API as absolute URLs. x-default points at the
 * language-neutral shop in the default locale, which is what a search for the
 * brand with no language preference should land on.
 */
export function setCanonical({ canonical, alternates = {}, defaultLocale = 'fr' }) {
  // upsertLink, not setLink: setLink only rewrites a tag that already exists
  // and returns silently otherwise, and no canonical ships in index.html, so
  // the three locales of one product competed exactly as the comment below
  // says they should not.
  if (canonical) upsertLink('canonical', { href: canonical })

  // hreflang links are keyed by language, so they are matched and replaced as
  // a set rather than one by one: a page with fewer locales than the last one
  // must not keep a stale tag pointing at a language it does not have.
  document.head.querySelectorAll('link[data-seo="hreflang"]').forEach((el) => el.remove())

  for (const [hreflang, href] of Object.entries(alternates)) {
    if (!href) continue
    const el = ensureLink('alternate', { hreflang, 'data-seo': 'hreflang' })
    el.setAttribute('href', href)
  }

  // x-default is the fallback for a searcher with no language preference, so
  // it points at the default locale rather than at the current one.
  if (alternates[defaultLocale]) {
    const el = ensureLink('alternate', { hreflang: 'x-default', 'data-seo': 'hreflang' })
    el.setAttribute('href', alternates[defaultLocale])
  }
}

/**
 * Keeps pages that should not be indexed out of results.
 *
 * Cart, checkout, order confirmation and search are reachable by URL. A
 * `noindex` on them is a second line of defence behind robots.txt, for crawlers
 * that reach them by link rather than by fetching robots.txt first.
 */
export const setRobots = (value) => setMeta('robots', value)

/** Clears the previous page's tags. Called before a new page fills them in. */
export function resetSeo() {
  owned.forEach((el) => el.remove())
  owned.clear()
  document.head.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove())
  document.head.querySelectorAll('[data-seo="hreflang"]').forEach((el) => el.remove())
  document.head.querySelectorAll('script[data-seo="jsonld"]').forEach((el) => el.remove())
}

/**
 * JSON-LD. Written as a script the browser will not execute, which is the whole
 * point: this is for crawlers, not the page.
 */
export function setJsonLd(data) {
  if (!data) return

  let el = document.head.querySelector('script[data-seo="jsonld"]')
  if (!el) {
    el = document.createElement('script')
    el.setAttribute('type', 'application/ld+json')
    el.setAttribute('data-seo', 'jsonld')
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}
/** The storefront origin, for building absolute URLs in the browser. */
export const storefrontOrigin = () =>
  (import.meta.env.VITE_STOREFRONT_URL || window.location.origin).replace(/\/$/, '')

/** Absolute URL for a storefront path, as the API would have returned it. */
export const absolute = (path = '/') => `${storefrontOrigin()}${path.startsWith('/') ? path : `/${path}`}`

/**
 * The store as a schema.org OnlineStore, so its name and social profiles can
 * appear beside search results instead of only in the footer.
 */
export function organisationJsonLd(home, locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': `${absolute(`/${locale}`)}#store`,
    name: 'Chamma Store',
    url: absolute(`/${locale}`),
    ...(home?.hero?.image ? { logo: home.hero.image } : {}),
  }
}
