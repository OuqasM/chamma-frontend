/**
 * Writes one static HTML document per indexable storefront URL.
 *
 * Why this exists
 * ---------------
 * The storefront is a client-rendered SPA: every URL in the sitemap answered
 * with the same 6 KB shell — the French home title, no canonical, no product
 * name, no price, no JSON-LD, and an empty <div id="root">. Google can render
 * JavaScript, but it does so in a second, delayed pass; WhatsApp, Facebook,
 * Bing and every AI crawler never run it at all. On a new domain that is the
 * difference between "indexed in weeks" and "not indexed at all".
 *
 * What it writes
 * --------------
 * `dist/_pages/fr/products/<slug>.html` (and the same for the catalogue,
 * categories, brands and the three home pages), with:
 *
 *   - <html lang> and dir set to the page's locale
 *   - the page's own <title>, description, canonical and hreflang set
 *   - per-page Open Graph / Twitter tags, so a product link shared on WhatsApp
 *     shows the perfume rather than the generic home card
 *   - schema.org JSON-LD (Product + Offer + BreadcrumbList, or CollectionPage)
 *   - the real content inside #root: name, brand, price, stock, description,
 *     and the listing's products
 *
 * React clears #root the moment the bundle mounts, so a shopper sees the
 * prerendered page instantly and then the live app; a crawler that never runs
 * JavaScript still gets the product.
 *
 * Data comes from the same API the app reads, at build time. The URL set is
 * read from `dist/sitemap.xml` — written by `scripts/fetch-sitemap.mjs`
 * immediately before this — so the pages that exist and the pages Google is
 * told about can never disagree.
 *
 * The files live in `_pages/` rather than at the URL's own path on purpose.
 * A directory at `dist/fr/products/<slug>/index.html` makes mod_dir answer
 * `/fr/products/<slug>` with a 301 to the trailing-slash form, and the
 * canonical in the page names the no-slash URL — the two would disagree on
 * every product. `.htaccess` maps the URL to this side tree instead.
 *
 * The build fails if the catalogue cannot be read: shipping the SPA shell for
 * every URL is the exact failure this script exists to remove, and it is
 * invisible from the outside.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dictionaries, dirFor, LOCALES } from '../src/lib/i18n.js'
import { formatPrice } from '../src/lib/format.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const PAGES = path.join(DIST, '_pages')
const SITEMAP = path.join(DIST, 'sitemap.xml')

const OG_LOCALE = { fr: 'fr_MA', ar: 'ar_MA', en: 'en_US' }
const DEFAULT_IMAGE = '/og-image.jpg'
const CARD_WIDTH = 1200
const CARD_HEIGHT = 630

/**
 * The image a chat app can actually draw.
 *
 * Product photographs are WebP, and WhatsApp's support for WebP previews is
 * inconsistent — a link whose og:image is WebP is sometimes shown with no
 * picture at all, and WhatsApp caches that first failure. The branded JPEG
 * card always works, so a WebP product image falls back to it. Google reads
 * WebP fine, and the SPA still writes the product image after mount.
 */
function socialImage(url, origin, { width, height } = {}) {
  if (!url || /\.webp($|\?)/i.test(url)) {
    return { image: `${origin}${DEFAULT_IMAGE}`, imageWidth: CARD_WIDTH, imageHeight: CARD_HEIGHT }
  }
  return { image: absolute(url, origin), imageWidth: width, imageHeight: height }
}

const esc = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c])

/** JSON-LD is inline script text: `<` must not be able to close the tag. */
const jsonLdScript = (data) =>
  `<script type="application/ld+json" data-seo="jsonld">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

/** Reads the Vite env file so this and the bundle cannot disagree on the API host. */
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

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`)
  return res.json()
}

/** The catalogue is paginated; 100 is the largest page the API accepts. */
async function allProducts(api, locale) {
  const products = []
  let page = 1
  let last = 1

  do {
    const body = await getJson(`${api}/api/${locale}/products?per_page=100&page=${page}`)
    products.push(...(body.data ?? []))
    last = body.meta?.last_page ?? 1
    page += 1
  } while (page <= last)

  return products
}

async function loadLocale(api, locale) {
  const [products, categories, brands, home] = await Promise.all([
    allProducts(api, locale),
    getJson(`${api}/api/${locale}/categories`),
    getJson(`${api}/api/${locale}/brands`),
    getJson(`${api}/api/${locale}/home`),
  ])

  const list = (body) => body.data ?? body

  return {
    products,
    productBySlug: new Map(products.map((p) => [p.slug, p])),
    categoryBySlug: new Map(list(categories).map((c) => [c.slug, c])),
    brandBySlug: new Map(list(brands).map((b) => [b.slug, b])),
    home,
  }
}

function parseSitemap(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

/** One page's metadata, in the shape the head builder wants. */
function describe(url, origin, data) {
  const { pathname } = new URL(url)
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  const [locale, kind, slug] = parts

  if (!LOCALES.includes(locale)) return null
  if (kind && !['products', 'categories', 'brands'].includes(kind)) return null

  const d = dictionaries[locale]
  const canonical = `${origin}/${locale}${kind ? `/${kind}${slug ? `/${slug}` : ''}` : ''}`
  const alternates = Object.fromEntries(
    LOCALES.map((l) => [l, `${origin}/${l}${kind ? `/${kind}${slug ? `/${slug}` : ''}` : ''}`]),
  )

  if (!kind) {
    return {
      kind: 'home',
      locale,
      d,
      canonical,
      alternates,
      title: d.seo.siteName,
      description: d.seo.homeDescription,
      // The branded card, not the hero: the hero is an editorial SVG and no
      // social crawler renders one as a preview image.
      image: `${origin}${DEFAULT_IMAGE}`,
      imageWidth: CARD_WIDTH,
      imageHeight: CARD_HEIGHT,
      ogType: 'website',
    }
  }

  if (kind === 'products' && !slug) {
    return {
      kind: 'catalogue',
      locale,
      d,
      canonical,
      alternates,
      title: d.seo.shopTitle,
      description: d.seo.shopDescription,
      image: `${origin}${DEFAULT_IMAGE}`,
      imageWidth: CARD_WIDTH,
      imageHeight: CARD_HEIGHT,
      ogType: 'website',
    }
  }

  if (kind === 'products') {
    const p = data.productBySlug.get(slug)
    if (!p) return null

    return {
      kind: 'product',
      locale,
      d,
      canonical: p.canonical,
      alternates: p.alternates ?? alternates,
      title: `${p.seo?.title || p.name} | ${d.seo.siteName}`,
      description: p.seo?.description || '',
      ...socialImage(p.image?.url, origin, {
        width: p.image?.dimensions?.width,
        height: p.image?.dimensions?.height,
      }),
      ogType: 'product',
      product: p,
    }
  }

  if (kind === 'categories') {
    const c = data.categoryBySlug.get(slug)
    if (!c) return null

    return {
      kind: 'category',
      locale,
      d,
      canonical: c.canonical,
      alternates: c.alternates ?? alternates,
      title: `${c.seo?.title || c.name} | ${d.seo.siteName}`,
      description: c.seo?.description || c.description || '',
      ...socialImage(c.image?.url, origin, { width: c.image?.width, height: c.image?.height }),
      ogType: 'website',
      category: c,
    }
  }

  const b = data.brandBySlug.get(slug)
  if (!b) return null

  return {
    kind: 'brand',
    locale,
    d,
    canonical: b.canonical,
    alternates: b.alternates ?? alternates,
    title: `${b.name} | ${d.seo.siteName}`,
    description: b.tagline || b.description || d.seo.homeDescription,
    ...socialImage(b.logo, origin),
    ogType: 'website',
    brand: b,
  }
}

const absolute = (url, origin) =>
  /^https?:\/\//i.test(url) ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`

function headFor(page) {
  const tags = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    `<meta name="robots" content="index, follow">`,
    `<link rel="canonical" href="${esc(page.canonical)}">`,
  ]

  for (const [hreflang, href] of Object.entries(page.alternates ?? {})) {
    if (href) tags.push(`<link rel="alternate" hreflang="${esc(hreflang)}" href="${esc(href)}">`)
  }
  if (page.alternates?.fr) {
    tags.push(`<link rel="alternate" hreflang="x-default" href="${esc(page.alternates.fr)}">`)
  }

  tags.push(
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:image" content="${esc(page.image)}">`,
    ...(page.imageWidth && page.imageHeight
      ? [
          `<meta property="og:image:width" content="${page.imageWidth}">`,
          `<meta property="og:image:height" content="${page.imageHeight}">`,
        ]
      : []),
    `<meta property="og:image:alt" content="${esc(page.title)}">`,
    `<meta property="og:type" content="${page.ogType}">`,
    `<meta property="og:site_name" content="${esc(page.d.seo.siteName)}">`,
    `<meta property="og:url" content="${esc(page.canonical)}">`,
    `<meta property="og:locale" content="${OG_LOCALE[page.locale] ?? 'fr_MA'}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    `<meta name="twitter:description" content="${esc(page.description)}">`,
    `<meta name="twitter:image" content="${esc(page.image)}">`,
  )

  return tags.join('\n    ')
}

function jsonLdFor(page) {
  const { d, locale, canonical } = page

  if (page.kind === 'product') {
    const p = page.product
    const categories = p.categories ?? []

    const graph = [
      {
        '@type': 'Product',
        '@id': `${canonical}#product`,
        name: p.name,
        description: p.seo?.description,
        sku: p.sku || undefined,
        gtin: p.gtin || undefined,
        image: p.image?.url,
        brand: p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined,
        offers: {
          '@type': 'Offer',
          url: canonical,
          priceCurrency: 'MAD',
          price: Number(p.price).toFixed(2),
          availability: p.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
        ...(Number(p.rating_count) > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Number(p.rating).toFixed(1),
                reviewCount: Number(p.rating_count),
              },
            }
          : {}),
      },
    ]

    if (categories.length) {
      graph.unshift({
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: d.nav.home, item: `${new URL(canonical).origin}/${locale}` },
          ...categories.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 2,
            name: c.name,
            item: `${new URL(canonical).origin}/${locale}/categories/${c.slug}`,
          })),
          { '@type': 'ListItem', position: categories.length + 2, name: p.name, item: canonical },
        ],
      })
    }

    return { '@context': 'https://schema.org', '@graph': graph }
  }

  if (page.kind === 'home') {
    return {
      '@context': 'https://schema.org',
      '@type': 'OnlineStore',
      '@id': `${canonical}#store`,
      name: 'Chamma Store',
      url: canonical,
      ...(page.image ? { logo: page.image } : {}),
    }
  }

  const name =
    page.kind === 'catalogue'
      ? d.seo.shopTitle
      : page.kind === 'category'
        ? page.category.name
        : page.brand.name

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: d.nav.home, item: `${new URL(canonical).origin}/${locale}` },
          { '@type': 'ListItem', position: 2, name, item: canonical },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#page`,
        name,
        description: page.description,
        url: canonical,
      },
    ],
  }
}

function card(p, locale) {
  const image = p.image?.thumb || p.image?.url
  return `<a class="block" href="/${locale}/products/${esc(p.slug)}">
  ${image ? `<img src="${esc(image)}" alt="${esc(p.image?.alt || p.name)}" width="320" height="320" loading="lazy" class="w-full">` : ''}
  <span class="mt-2 block text-sm text-noir">${esc(p.name)}</span>
  <span class="block text-sm text-stone-600">${esc(formatPrice(p.price, locale))}</span>
</a>`
}

function grid(products, locale) {
  if (!products.length) return ''
  return `<div class="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">${products
    .map((p) => card(p, locale))
    .join('')}</div>`
}

function bodyFor(page, data) {
  const { d, locale, kind } = page

  if (kind === 'product') {
    const p = page.product
    const categories = p.categories ?? []
    const description = p.description_html || (p.description ? `<p>${esc(p.description)}</p>` : '')

    return `<main class="mx-auto max-w-7xl px-4 py-10">
  <nav class="mb-8 text-xs text-stone-400">
    <a href="/${locale}">${esc(d.nav.home)}</a>
    ${categories.map((c) => ` / <a href="/${locale}/categories/${esc(c.slug)}">${esc(c.name)}</a>`).join('')}
    / <span class="text-stone-600">${esc(p.name)}</span>
  </nav>
  <div class="grid gap-10 md:grid-cols-2">
    <div>
      ${p.image?.url ? `<img src="${esc(p.image.url)}" alt="${esc(p.image.alt || p.name)}" width="800" height="800" class="w-full">` : ''}
    </div>
    <div>
      ${p.brand ? `<a class="text-xs uppercase tracking-[0.25em] text-stone-500" href="/${locale}/brands/${esc(p.brand.slug)}">${esc(p.brand.name)}</a>` : ''}
      <h1 class="mt-2 font-serif text-3xl leading-tight text-noir md:text-4xl">${esc(p.name)}</h1>
      <p class="mt-5 text-2xl font-semibold tracking-tight text-noir">${esc(formatPrice(p.price, locale))}</p>
      <p class="mt-3 text-xs">${p.in_stock ? esc(d.product.inStock) : esc(d.product.outOfStock)}</p>
      <dl class="mt-6 space-y-1.5 border-y border-stone-200 py-4 text-xs text-stone-600">
        ${p.size ? `<div class="flex justify-between"><dt class="text-stone-400">${esc(d.product.size)}</dt><dd>${esc(p.size)}</dd></div>` : ''}
        ${p.gender ? `<div class="flex justify-between"><dt class="text-stone-400">${esc(d.product.gender)}</dt><dd>${esc(d.product[p.gender] || p.gender)}</dd></div>` : ''}
        ${p.sku ? `<div class="flex justify-between"><dt class="text-stone-400">${esc(d.product.sku)}</dt><dd>${esc(p.sku)}</dd></div>` : ''}
      </dl>
      <div class="rich-text mt-6">${description}</div>
    </div>
  </div>
</main>`
  }

  if (kind === 'catalogue') {
    return `<main class="mx-auto max-w-7xl px-4 py-10">
  <h1 class="font-serif text-3xl text-noir">${esc(d.nav.shop)}</h1>
  <p class="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">${esc(d.seo.shopDescription)}</p>
  ${grid(data.products.slice(0, 24), locale)}
</main>`
  }

  if (kind === 'home') {
    const brands = (data.home?.brands ?? []).slice(0, 12)

    return `<main class="mx-auto max-w-7xl px-4 py-10">
  <h1 class="font-serif text-4xl text-noir">${esc(d.home.heroTitle)}</h1>
  <p class="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">${esc(d.seo.homeDescription)}</p>
  ${brands.length ? `<h2 class="mt-10 font-serif text-2xl text-noir">${esc(d.home.shopByBrand)}</h2><ul class="mt-4 flex flex-wrap gap-4">${brands.map((b) => `<li><a href="/${locale}/brands/${esc(b.slug)}">${esc(b.name)}</a></li>`).join('')}</ul>` : ''}
  ${grid(data.products.slice(0, 8), locale)}
</main>`
  }

  const entity = kind === 'category' ? page.category : page.brand
  const description = entity.description || entity.tagline || ''

  return `<main class="mx-auto max-w-7xl px-4 py-10">
  <nav class="mb-8 text-xs text-stone-400"><a href="/${locale}">${esc(d.nav.home)}</a> / <span class="text-stone-600">${esc(entity.name)}</span></nav>
  <h1 class="font-serif text-3xl text-noir">${esc(entity.name)}</h1>
  ${description ? `<p class="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">${esc(description)}</p>` : ''}
  ${grid(
    data.products.filter((p) =>
      kind === 'category'
        ? (p.categories ?? []).some((c) => c.slug === entity.slug)
        : p.brand?.slug === entity.slug,
    ).slice(0, 24),
    locale,
  )}
</main>`
}

/** Puts the page's head, language and content into the built shell. */
function render(shell, page, data) {
  const html = shell
    .replace(/<html lang="[^"]*"( dir="[^"]*")?>/, `<html lang="${page.locale}" dir="${dirFor(page.locale)}">`)
    .replace(/<title>[^<]*<\/title>/, '')
    // The static block is the French home card. Left in place, every page
    // would ship two og:title tags and the crawler would read the first one.
    .replace(/^[ \t]*<meta (?:property="og:|name="twitter:)[^>]*>\n?/gm, '')
    .replace('</head>', `    ${headFor(page)}\n    ${jsonLdScript(jsonLdFor(page))}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${bodyFor(page, data)}</div>`)

  if (!html.includes('id="root"') || html.includes('<div id="root"></div>')) {
    throw new Error(`could not inject content into the shell for ${page.canonical}`)
  }

  return html
}

async function main() {
  const env = await readViteEnv()
  const api = (process.env.VITE_API_URL || env.VITE_API_URL || '').replace(/\/$/, '')
  if (!api) throw new Error('VITE_API_URL is not set, so the pages cannot be prerendered')

  const [shell, sitemap] = await Promise.all([
    readFile(path.join(DIST, 'index.html'), 'utf8'),
    readFile(SITEMAP, 'utf8'),
  ])

  const urls = parseSitemap(sitemap)
  if (!urls.length) throw new Error('dist/sitemap.xml has no URLs; refusing to prerender')

  const origin = (process.env.VITE_STOREFRONT_URL || env.VITE_STOREFRONT_URL || new URL(urls[0]).origin).replace(/\/$/, '')

  // Generated output, not source: removing it first is what stops a deleted
  // product from keeping an indexable page forever. The bare locale trees are
  // from the first version of this script and are removed so an older deploy
  // cannot keep answering those URLs through the directory rules.
  await rm(PAGES, { recursive: true, force: true })
  for (const locale of LOCALES) {
    await rm(path.join(DIST, locale), { recursive: true, force: true })
  }

  const data = Object.fromEntries(
    await Promise.all(LOCALES.map(async (locale) => [locale, await loadLocale(api, locale)])),
  )

  let written = 0
  const skipped = []

  for (const url of urls) {
    const page = describe(url, origin, data[new URL(url).pathname.split('/').filter(Boolean)[0]])
    if (!page) {
      skipped.push(url)
      continue
    }

    const target = path.join(PAGES, `${new URL(page.canonical).pathname}.html`)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, render(shell, page, data[page.locale]), 'utf8')
    written += 1
  }

  if (!written) throw new Error('no page was prerendered; the sitemap and the catalogue disagree')

  console.log(`prerender: ${written} pages → dist/_pages`)
  if (skipped.length) {
    console.warn(`prerender: ${skipped.length} sitemap URLs had no data and keep the SPA shell:`)
    for (const url of skipped.slice(0, 10)) console.warn(`  ${url}`)
  }
}

main().catch((error) => {
  console.error(`prerender failed: ${error.message}`)
  process.exit(1)
})
