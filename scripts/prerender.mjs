/**
 * Prerenders every indexable storefront page to static HTML.
 *
 * Why this exists
 * ---------------
 * The storefront is a client-rendered SPA. The HTML Vite produces is a 500-byte
 * shell — an empty `<div id="root">` and a generic title — and everything a
 * crawler needs (product name, meta description, canonical, hreflang,
 * JSON-LD, the description text itself) is written into <head> at runtime by
 * `src/lib/seo.js`.
 *
 * Google does execute JavaScript, but it is a second pass: the first fetch sees
 * an empty page. On a domain this young, that empty first pass is the whole
 * problem — there is no history and no inbound links to make Google come back
 * for the render. A prerender removes the dependency entirely.
 *
 * How it works
 * ------------
 * The API is the source of truth, so this reads from the same endpoints the
 * browser does and reuses the app's own dictionaries and price formatter. The
 * strings in the prerendered page are therefore the same strings the app would
 * have written a moment later, rather than a second copy that can drift.
 *
 * The prerendered markup lives *inside* `#root`, and React clears it on mount
 * (`createRoot`, not `hydrateRoot`). Crawlers read the text; visitors get the
 * real application. There is a brief moment before the bundle executes where
 * the static shell is what is on screen, which is why the shell carries inline
 * styles rather than Tailwind classes: the build purges any class it cannot
 * find in `src/`, so utility classes written here would not survive the build.
 *
 * A failure here fails the build. Emitting a partial set of pages would look
 * like success and quietly leave some URLs in the old empty-shell state, which
 * is the exact failure this script exists to remove.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dictionaries, DEFAULT_LOCALE } from '../src/lib/i18n.js'
import { formatPrice } from '../src/lib/format.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')

const SITE_NAME = 'Chamma Store'
const CURRENCY = 'MAD'
const OG_LOCALE = { fr: 'fr_MA', ar: 'ar_MA', en: 'en_US' }

/* ------------------------------------------------------------------ config */

/** Reads the Vite env file so the script and the bundle cannot disagree. */
async function readViteEnv(file = '.env.production') {
  const out = {}

  let raw = ''
  try {
    raw = await readFile(path.join(ROOT, file), 'utf8')
  } catch {
    return out
  }

  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }

  return out
}

/* -------------------------------------------------------------------- http */

async function apiGet(origin, pathname) {
  const res = await fetch(`${origin}${pathname}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`GET ${pathname} → HTTP ${res.status}`)
  }

  return res.json()
}

/* --------------------------------------------------------------- escaping */

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** JSON-LD is injected into a <script>; `</script>` inside it would close it. */
const escapeJsonLd = (data) =>
  JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')

/** The API sends a description with markup for the running app to render. */
function plainText(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Long descriptions are truncated for the shell; the page shows the whole thing. */
function clip(text, max = 900) {
  const clean = plainText(text)
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`
}

/* ------------------------------------------------------------------ shell */

const style = {
  page: 'max-width:72rem;margin:0 auto;padding:2.5rem 1rem;font-family:Georgia,serif;color:#1c1917;',
  eyebrow: 'font:600 .75rem/1.4 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#a8a29e;margin:0 0 .5rem;',
  h1: 'font-size:2rem;line-height:1.2;margin:0 0 .75rem;',
  h2: 'font-size:1.25rem;line-height:1.3;margin:2rem 0 .75rem;',
  meta: 'font:400 .9rem/1.6 system-ui,sans-serif;color:#57534e;',
  price: 'font:600 1.5rem/1.2 system-ui,sans-serif;margin:.75rem 0;',
  struck: 'text-decoration:line-through;color:#a8a29e;font-weight:400;margin-inline-end:.5rem;',
  body: 'font:400 1rem/1.7 system-ui,sans-serif;color:#44403c;max-width:46rem;',
  list: 'list-style:none;padding:0;margin:1rem 0;display:grid;gap:.5rem;',
  item: 'font:400 1rem/1.5 system-ui,sans-serif;color:#44403c;',
  out: 'font:600 .8rem/1.4 system-ui,sans-serif;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;',
  nav: 'font:400 .85rem/1.5 system-ui,sans-serif;color:#78716c;',
  img: 'max-width:100%;height:auto;border-radius:.5rem;',
}

const p = (text, extra = '') => (text ? `<p style="${extra}">${escapeHtml(text)}</p>` : '')

/**
 * A category's URL.
 *
 * The API returns categories nested inside a product as `{id, slug, name}` with
 * no `canonical`, so a breadcrumb built from that field alone ships `item: ""`
 * to a crawler — an invalid BreadcrumbList entry. The slug is enough to rebuild
 * the same URL the taxonomy page lives at.
 */
const categoryUrl = (category, locale) => category.canonical || absoluteUrl(`/${locale}/categories/${category.slug}`)

/* ------------------------------------------------------------------- pages */

/**
 * One page model, whatever the type. `render` writes a separate file per page
 * rather than templating the app, so there is no shared markup between the
 * prerendered shell and the React components that replace it — the two can
 * never be half-updated in step.
 */
function productPage(product, locale) {
  const { t } = pick(locale)
  const canonical = product.canonical
  const description = product.seo?.description || clip(product.description_html || product.short_description_html, 300)

  const crumbs = (product.categories ?? []).filter((c) => c?.name)

  const body = [
    `<div style="${style.page}" dir="${dictionaries[locale].dir}">`,
    `<nav style="${style.nav}">`,
    `<a href="${escapeHtml(`${origin()}/${locale}`)}" style="color:inherit">${escapeHtml(t('nav', 'home'))}</a>`,
    ...crumbs.map((c) => ` / <a href="${escapeHtml(categoryUrl(c, locale))}" style="color:inherit">${escapeHtml(c.name)}</a>`),
    '</nav>',
    `<h1 style="${style.h1}">${escapeHtml(product.name)}</h1>`,
    product.brand?.name ? p(product.brand.name, style.eyebrow) : '',
    `<div style="${style.price}">`,
    product.compare_at_price ? `<span style="${style.struck}">${escapeHtml(formatPrice(product.compare_at_price, locale))}</span>` : '',
    escapeHtml(formatPrice(product.price, locale)),
    '</div>',
    product.in_stock ? '' : `<p style="${style.out}">${escapeHtml(t('product', 'outOfStock') ?? 'Rupture de stock')}</p>`,
    product.image?.url ? `<img src="${escapeHtml(product.image.url)}" alt="${escapeHtml(product.image.alt || product.name)}" style="${style.img}">` : '',
    clip(product.description_html || product.short_description_html)
      ? `<div style="${style.body}"><p>${escapeHtml(clip(product.description_html || product.short_description_html))}</p></div>`
      : '',
    '</div>',
  ].join('')

  return {
    canonical,
    alternates: product.alternates,
    title: `${product.seo?.title || product.name} | ${SITE_NAME}`,
    description,
    image: product.image?.url,
    type: 'product',
    body,
    jsonLd: productJsonLd(product, crumbs, locale),
  }
}

function taxonomyPage(entity, kind, locale, products) {
  const canonical = entity.canonical
  const description = entity.seo?.description || clip(entity.description, 300)

  const body = [
    `<div style="${style.page}" dir="${dictionaries[locale].dir}">`,
    `<h1 style="${style.h1}">${escapeHtml(entity.name)}</h1>`,
    entity.description ? `<div style="${style.body}"><p>${escapeHtml(clip(entity.description))}</p></div>` : '',
    products?.length
      ? `<ul style="${style.list}">${products
          .map(
            (product) =>
              `<li style="${style.item}"><a href="${escapeHtml(product.url || product.canonical || '')}" style="color:inherit">${escapeHtml(product.name)}</a></li>`,
          )
          .join('')}</ul>`
      : '',
    '</div>',
  ].join('')

  return {
    canonical,
    alternates: entity.alternates,
    title: `${entity.seo?.title || entity.name} | ${SITE_NAME}`,
    description,
    image: entity.image?.url ?? entity.logo,
    type: 'website',
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: absoluteUrl(`/${locale}`) },
        { '@type': 'ListItem', position: 2, name: entity.name, item: canonical },
      ],
    },
    kind,
  }
}

function cataloguePage(locale, products) {
  const { t } = pick(locale)

  return {
    canonical: absoluteUrl(`/${locale}/products`),
    alternates: {
      fr: absoluteUrl('/fr/products'),
      ar: absoluteUrl('/ar/products'),
      en: absoluteUrl('/en/products'),
    },
    title: t('seo', 'shopTitle'),
    description: t('seo', 'shopDescription'),
    image: null,
    type: 'website',
    body: [
      `<div style="${style.page}" dir="${dictionaries[locale].dir}">`,
      `<h1 style="${style.h1}">${escapeHtml(t('nav', 'shop'))}</h1>`,
      `<ul style="${style.list}">${products
        .map(
          (product) =>
            `<li style="${style.item}"><a href="${escapeHtml(product.url || product.canonical || '')}" style="color:inherit">${escapeHtml(product.name)}</a> — ${escapeHtml(formatPrice(product.price, locale))}</li>`,
        )
        .join('')}</ul>`,
      '</div>',
    ].join(''),
    jsonLd: null,
  }
}

function homePage(locale, home) {
  const { t } = pick(locale)

  const section = (title, items) =>
    items?.length
      ? `<h2 style="${style.h2}">${escapeHtml(title)}</h2><ul style="${style.list}">${items
          .map((item) => {
            const href = item.canonical || item.url || ''
            const name = item.name || item.seo?.title || ''
            return `<li style="${style.item}"><a href="${escapeHtml(href)}" style="color:inherit">${escapeHtml(name)}</a></li>`
          })
          .join('')}</ul>`
      : ''

  const body = [
    `<div style="${style.page}" dir="${dictionaries[locale].dir}">`,
    home?.hero?.eyebrow ? p(home.hero.eyebrow, style.eyebrow) : '',
    `<h1 style="${style.h1}">${escapeHtml(t('seo', 'homeTitle'))}</h1>`,
    home?.hero?.image ? `<img src="${escapeHtml(home.hero.image)}" alt="" style="${style.img}">` : '',
    `<p style="${style.body}">${escapeHtml(t('seo', 'homeDescription'))}</p>`,
    section(label(locale, 'nav', 'categories', 'Categories'), home?.categories),
    section(label(locale, 'nav', 'brands', 'Brands'), home?.brands),
    section('Best sellers', home?.best_sellers),
    section(label(locale, 'nav', 'new', 'New arrivals'), home?.new_arrivals),
    '</div>',
  ].join('')

  return {
    canonical: absoluteUrl(`/${locale}`),
    // Home is the x-default target, so all three locales point back here rather
    // than at each other. Mirrors Home.jsx.
    alternates: {
      fr: absoluteUrl('/fr'),
      ar: absoluteUrl('/ar'),
      en: absoluteUrl('/en'),
    },
    title: t('seo', 'homeTitle'),
    description: t('seo', 'homeDescription'),
    image: home?.hero?.image,
    type: 'website',
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'OnlineStore',
      '@id': `${absoluteUrl(`/${locale}`)}#store`,
      name: SITE_NAME,
      url: absoluteUrl(`/${locale}`),
      ...(home?.hero?.image ? { logo: home.hero.image } : {}),
    },
  }
}

function productJsonLd(product, crumbs, locale) {
  const graph = [
    {
      '@type': 'Product',
      '@id': `${product.canonical}#product`,
      name: product.name,
      description: product.seo?.description,
      sku: product.sku || undefined,
      image: product.image?.url,
      brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
      offers: {
        '@type': 'Offer',
        url: product.canonical,
        priceCurrency: CURRENCY,
        price: Number(product.price).toFixed(2),
        availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
      ...(Number(product.rating_count) > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(product.rating).toFixed(1),
              reviewCount: Number(product.rating_count),
            },
          }
        : {}),
    },
  ]

  if (crumbs.length) {
    graph.unshift({
      '@type': 'BreadcrumbList',
      '@id': `${product.canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: crumbs[0].name, item: categoryUrl(crumbs[0], locale) },
        ...crumbs.slice(1).map((c, i) => ({
          '@type': 'ListItem',
          position: i + 2,
          name: c.name,
          item: categoryUrl(c, locale),
        })),
      ],
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}

/* ----------------------------------------------------------------- render */

let storefront = ''

const origin = () => storefront

const absoluteUrl = (p) => `${storefront}${p.startsWith('/') ? p : `/${p}`}`

/** Minimal t(), reading the same dictionary the running app would. */
function pick(locale) {
  return {
    t: (group, key) => dictionaries[locale]?.[group]?.[key] ?? null,
  }
}

/** A dictionary key that may not exist in every locale, with a literal fallback. */
function label(locale, group, key, fallback) {
  return pick(locale).t(group, key) ?? fallback
}

function renderHead(page, locale) {
  const tags = []

  tags.push(`<meta name="description" content="${escapeHtml(page.description ?? '')}">`)
  tags.push(`<meta name="robots" content="index, follow">`)

  tags.push(`<meta property="og:title" content="${escapeHtml(page.title ?? '')}">`)
  tags.push(`<meta property="og:description" content="${escapeHtml(page.description ?? '')}">`)
  if (page.image) tags.push(`<meta property="og:image" content="${escapeHtml(page.image)}">`)
  tags.push(`<meta property="og:type" content="${escapeHtml(page.type ?? 'website')}">`)
  tags.push(`<meta property="og:url" content="${escapeHtml(page.canonical ?? '')}">`)
  tags.push(`<meta property="og:locale" content="${escapeHtml(OG_LOCALE[locale] ?? 'fr_MA')}">`)
  tags.push(`<meta property="og:site_name" content="${SITE_NAME}">`)

  tags.push(`<meta name="twitter:card" content="${page.image ? 'summary_large_image' : 'summary'}">`)
  tags.push(`<meta name="twitter:title" content="${escapeHtml(page.title ?? '')}">`)
  tags.push(`<meta name="twitter:description" content="${escapeHtml(page.description ?? '')}">`)
  if (page.image) tags.push(`<meta name="twitter:image" content="${escapeHtml(page.image)}">`)

  if (page.canonical) tags.push(`<link rel="canonical" href="${escapeHtml(page.canonical)}">`)

  // data-seo marks the hreflang set so `resetSeo()` in the running app can find
  // and replace it as a group, exactly as it does for tags it created itself.
  for (const [hreflang, href] of Object.entries(page.alternates ?? {})) {
    if (!href) continue
    tags.push(`<link rel="alternate" hreflang="${escapeHtml(hreflang)}" data-seo="hreflang" href="${escapeHtml(href)}">`)
  }
  if (page.alternates?.[DEFAULT_LOCALE]) {
    tags.push(
      `<link rel="alternate" hreflang="x-default" data-seo="hreflang" href="${escapeHtml(page.alternates[DEFAULT_LOCALE])}">`,
    )
  }

  if (page.jsonLd) {
    tags.push(`<script type="application/ld+json" data-seo="jsonld">${escapeJsonLd(page.jsonLd)}</script>`)
  }

  return tags.join('\n    ')
}

function renderDocument(template, page, locale) {
  const head = renderHead(page, locale)

  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(page.title ?? SITE_NAME)}</title>`)
    .replace('<html lang="fr">', `<html lang="${escapeHtml(locale)}" dir="${dictionaries[locale].dir}">`)
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${page.body}</div>`)

  if (html === template) {
    throw new Error('the built index.html no longer matches what this script rewrites')
  }

  return html
}

/* ------------------------------------------------------------------- main */

/**
 * The sitemap, not the catalogue, decides which pages get prerendered.
 *
 * The two do not agree. The catalogue endpoint returns 31 products, 6
 * categories and 4 brands; the sitemap advertises 31, 9 and 5 — the difference
 * being categories and brands with no active products, which the list endpoints
 * filter out and the sitemap does not. Driving this from the catalogue would
 * leave those four URLs in the sitemap as empty shells, which is the one
 * outcome this script exists to prevent.
 *
 * So the URL set comes from the sitemap, the data comes from the API, and
 * anything the bulk endpoints did not return is fetched on its own. The result
 * is one file per <loc>: no URL a crawler can reach is left unrendered.
 */
function parseSitemap(xml) {
  const urls = []

  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    urls.push(match[1].replaceAll('&amp;', '&').trim())
  }

  return urls
}

function classify(pathname) {
  const [locale, ...rest] = pathname.split('/').filter(Boolean)
  if (!locale) return null

  if (rest.length === 0) return { locale, kind: 'home' }
  if (rest.length === 1 && rest[0] === 'products') return { locale, kind: 'catalogue' }
  if (rest.length === 2 && rest[0] === 'products') return { locale, kind: 'product', slug: decodeURIComponent(rest[1]) }
  if (rest.length === 2 && rest[0] === 'categories') return { locale, kind: 'category', slug: decodeURIComponent(rest[1]) }
  if (rest.length === 2 && rest[0] === 'brands') return { locale, kind: 'brand', slug: decodeURIComponent(rest[1]) }

  return null
}

/** The entity endpoint path for a taxonomy page. */
const taxonomyPath = (kind, slug) => `/${kind === 'brand' ? 'brands' : 'categories'}/${encodeURIComponent(slug)}`

/** Taxonomy detail responses hide the entity under `meta`, unlike the lists. */
function entityFrom(response, kind) {
  return response?.meta?.[kind === 'brand' ? 'brand' : 'category'] ?? null
}

/** Runs `worker` over `items` with a small cap on concurrency. */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await worker(items[index], index)
      }
    }),
  )

  return results
}

async function main() {
  const env = await readViteEnv()
  const apiOrigin = (process.env.VITE_API_URL || env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
  storefront = (process.env.VITE_STOREFRONT_URL || env.VITE_STOREFRONT_URL || '').replace(/\/$/, '')

  if (!storefront) {
    throw new Error(
      'VITE_STOREFRONT_URL is not set, so canonical URLs would be written with the wrong origin. ' +
        'Set it in .env.production or pass it in the environment.',
    )
  }

  console.log(`prerender → storefront ${storefront}, api ${apiOrigin}`)

  const sitemap = await fetch(`${apiOrigin}/api/sitemap.xml`, { headers: { Accept: 'application/xml' } })
  if (!sitemap.ok) throw new Error(`GET /api/sitemap.xml → HTTP ${sitemap.status}`)

  const wanted = parseSitemap(await sitemap.text()).map((loc) => classify(new URL(loc).pathname))
  const routes = wanted.filter(Boolean)

  const unroutable = wanted.length - routes.length
  if (unroutable) {
    throw new Error(`sitemap contained ${unroutable} URL(s) this script does not know how to route`)
  }

  console.log(`  sitemap: ${routes.length} indexable URLs`)

  const template = await readFile(path.join(DIST, 'index.html'), 'utf8')
  const pages = []

  for (const locale of Object.keys(dictionaries)) {
    const mine = routes.filter((route) => route.locale === locale)

    const [home, catalogue, categories, brands] = await Promise.all([
      apiGet(apiOrigin, `/api/${locale}/home`),
      apiGet(apiOrigin, `/api/${locale}/products?per_page=500`),
      apiGet(apiOrigin, `/api/${locale}/categories`),
      apiGet(apiOrigin, `/api/${locale}/brands`),
    ])

    // Indexed by both slugs: the catalogue advertises a `canonical_slug` that can
    // differ from the `slug` the sitemap and the canonical URL use.
    const products = new Map()
    for (const product of catalogue.data ?? []) {
      for (const key of [product.slug, product.canonical_slug]) {
        if (key) products.set(key, product)
      }
    }

    const taxonomies = {
      category: new Map((categories.data ?? []).map((c) => [c.slug, c])),
      brand: new Map((brands.data ?? []).map((b) => [b.slug, b])),
    }

    const taxonomyRoutes = mine.filter((r) => r.kind === 'category' || r.kind === 'brand')

    // Anything the list endpoints filtered out — empty categories, brands with no
    // active products — has to be asked for by name or it never gets rendered.
    const missing = taxonomyRoutes.filter((r) => !taxonomies[r.kind].has(r.slug))

    if (missing.length) {
      console.log(`  ${locale}: fetching ${missing.length} empty ${[...new Set(missing.map((r) => r.kind))].join('/')} page(s)`)

      const fetched = await mapLimit(missing, 6, async (route) => {
        const response = await apiGet(apiOrigin, `/api/${locale}${taxonomyPath(route.kind, route.slug)}`)
        return entityFrom(response, route.kind)
      })

      fetched.forEach((entity, i) => {
        if (entity) taxonomies[missing[i].kind].set(missing[i].slug, entity)
      })
    }

    for (const route of mine) {
      if (route.kind === 'home') {
        pages.push(homePage(locale, home))
        continue
      }

      if (route.kind === 'catalogue') {
        pages.push(cataloguePage(locale, catalogue.data ?? []))
        continue
      }

      if (route.kind === 'product') {
        const product = products.get(route.slug)
        if (!product) throw new Error(`${locale}: product "${route.slug}" is in the sitemap but not returned by the API`)
        pages.push(productPage(product, locale))
        continue
      }

      const entity = taxonomies[route.kind].get(route.slug)
      if (!entity) throw new Error(`${locale}: ${route.kind} "${route.slug}" is in the sitemap but not returned by the API`)

      const listed =
        route.kind === 'category'
          ? (catalogue.data ?? []).filter((product) => product.categories?.some((c) => c.slug === route.slug))
          : (catalogue.data ?? []).filter((product) => product.brand?.slug === route.slug)

      pages.push(taxonomyPage(entity, route.kind, locale, listed))
    }

    console.log(`  ${locale}: ${mine.length} pages`)
  }

  if (pages.length !== routes.length) {
    throw new Error(`built ${pages.length} pages for ${routes.length} sitemap URLs`)
  }

  for (const page of pages) {
    const { pathname } = new URL(page.canonical)

    // The canonical path is already percent-encoded by StorefrontUrl, which is
    // the form the web server matches on, so the file is named from it as-is.
    const target = path.join(DIST, pathname.replace(/^\/+/, '')) + '.html'

    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, renderDocument(template, page, localeOf(page.canonical)), 'utf8')
  }

  console.log(`prerendered ${pages.length} pages`)
}

const localeOf = (canonical) => new URL(canonical).pathname.split('/').filter(Boolean)[0]

main().catch((error) => {
  // The stack matters here: this is a build step, so the failure surfaces in CI
  // or on a deploy box where nobody can attach a debugger to it.
  console.error(`prerender failed: ${error.message}`)
  if (process.env.PRERENDER_DEBUG) console.error(error.stack)
  process.exit(1)
})
