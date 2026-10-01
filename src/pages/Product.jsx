import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, imageUrl } from '../lib/api'
import { useApp } from '../context/AppContext'
import { Price } from '../components/Price'
import { ProductGrid } from '../components/ProductCard'
import Carousel from '../components/Carousel'
import AddToCartButton from '../components/AddToCartButton'
import useSeo from '../hooks/useSeo'
import { absolute } from '../lib/seo'
import { Spinner, ErrorState } from '../components/Spinner'
import WaitlistForm from '../components/WaitlistForm'
import TranslatedDescription from '../components/TranslatedDescription'

export default function Product() {
  const { slug } = useParams()
  const { locale, t, toggleWishlist, inWishlist } = useApp()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError(null)
    setQuantity(1)

    api
      .product(locale, slug, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message)
      })

    return () => controller.abort()
  }, [locale, slug])

  const p = data?.product

  useSeo({
    title: p ? `${p.seo?.title || p.name} | Chamma Store` : 'Chamma Store',
    description: p?.seo?.description,
    image: p?.image?.url,
    canonical: p?.canonical,
    alternates: p?.alternates,
    type: 'product',
    jsonLd: p ? productJsonLd(p, locale) : null,
  })

  if (error) return <ErrorState message={error} />
  if (!data) return <Spinner label={t('common', 'loading')} />

  const gallery = p.images?.length ? p.images : p.image ? [p.image] : []
  const soldOut = !p.in_stock
  const wished = inWishlist(p.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <nav className="mb-8 text-xs text-stone-400">
        <Link to={`/${locale}`} className="hover:text-gold">{t('nav', 'home')}</Link>
        {/* A product can sit in several categories, so the trail shows them
            all. `category` is the API's compatibility alias and is only read
            when `categories` is missing, which is the case for a storefront
            bundle served against a backend that predates the list. */}
        {(p.categories ?? (p.category ? [p.category] : [])).map((c) => (
          <span key={c.id}>
            {' / '}
            <Link to={`/${locale}/categories/${c.slug}`} className="hover:text-gold">
              {c.name}
            </Link>
          </span>
        ))}
        {' / '}
        <span className="text-stone-600">{p.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <div>
          {/*
            A multi-image product gets the shared Carousel rather than a second
            hand-rolled pager: it already does scroll-snap, touch swipe, RTL
            chevrons, dots and reduced-motion, and the home page's "related
            products" rail uses the same component, so a shopper gets identical
            paging behaviour in both places. `--pv: 1` puts one image per page,
            which makes the arrow step and dot count equal the image count.

            Below two images it is not a carousel, so it is not rendered as one:
            `aria-roledescription="carousel"` over a single slide would be a lie,
            and the scroll viewport would be a pointless element around one img.
          */}
          {gallery.length > 1 ? (
            <Carousel
              items={gallery}
              perViewClass="[--pv:1]"
              ariaLabel={t('product', 'gallery')}
              renderItem={(img, i) => (
                <img
                  src={imageUrl(img.url)}
                  alt={img.alt || p.name}
                  // The first image is the page's LCP element, so it must not be
                  // lazy; the rest can be. The component renders every slide up
                  // front, which would otherwise fetch the whole gallery at once.
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className="aspect-[4/5] w-full object-cover"
                />
              )}
            />
          ) : gallery.length === 1 ? (
            <div className="overflow-hidden">
              <img
                src={imageUrl(gallery[0].url)}
                alt={gallery[0].alt || p.name}
                className="aspect-[4/5] w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center bg-ivory text-stone-300">Chamma</div>
          )}
        </div>

        <div>
          {p.brand && (
            <Link to={`/${locale}/brands/${p.brand.slug}`} className="text-xs uppercase tracking-[0.25em] text-stone-500 hover:text-gold">
              {p.brand.name}
            </Link>
          )}

          <h1 className="mt-2 font-serif text-3xl leading-tight text-noir md:text-4xl">{p.name}</h1>

          {p.short_description_html ? (
            // The API renders the merchant's markdown server-side into a fixed
            // tag set with author HTML escaped, so it is safe to inject here.
            <div
              className="rich-text rich-text-sm mt-3"
              dangerouslySetInnerHTML={{ __html: p.short_description_html }}
            />
          ) : (
            // A response predating the rendered fields: show the source as text
            // rather than trusting unrendered markdown as HTML.
            p.short_description && (
              <p className="mt-3 text-sm leading-relaxed text-stone-600">{p.short_description}</p>
            )
          )}

          <Price product={p} className="mt-5 text-xl" />

          <p className="mt-3 text-xs">
            {soldOut ? (
              <span className="text-rose-700">{t('product', 'outOfStock')}</span>
            ) : p.is_low_stock ? (
              <span className="text-amber-600">{t('product', 'lowStock', { n: p.stock })}</span>
            ) : (
              <span className="text-jade">{t('product', 'inStock')}</span>
            )}
          </p>

          <dl className="mt-6 space-y-1.5 border-y border-stone-200 py-4 text-xs text-stone-600">
            {p.size && (
              <div className="flex justify-between">
                <dt className="text-stone-400">{t('product', 'size')}</dt>
                <dd>{p.size}</dd>
              </div>
            )}
            {p.gender && (
              <div className="flex justify-between">
                <dt className="text-stone-400">{t('product', 'gender')}</dt>
                <dd>{t('product', p.gender)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-stone-400">{t('product', 'sku')}</dt>
              <dd>{p.sku}</dd>
            </div>
          </dl>

          {!soldOut && (
            <div className="mt-6 flex flex-wrap items-stretch gap-3">
              <div className="flex items-center border border-stone-200">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-4 py-3 text-lg text-stone-500 hover:text-gold"
                  aria-label="-"
                >
                  −
                </button>
                <span className="min-w-10 text-center text-sm">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(p.stock, q + 1))}
                  className="px-4 py-3 text-lg text-stone-500 hover:text-gold"
                  aria-label="+"
                >
                  +
                </button>
              </div>

              {/* Same button, then a link to the cart in the same place — the
                  shopper's next move after adding is the cart itself. */}
              <AddToCartButton
                product={p}
                quantity={quantity}
                className="flex-1 bg-noir px-6 py-3 text-center text-xs uppercase tracking-widest text-white transition hover:bg-gold"
                activeClassName="bg-gold hover:bg-noir"
              />

              <button
                onClick={() => toggleWishlist(p)}
                aria-label={t('product', 'addToWishlist')}
                className={`border px-4 text-lg transition ${wished ? 'border-gold text-gold' : 'border-stone-200 text-stone-400 hover:border-gold'}`}
              >
                {wished ? '♥' : '♡'}
              </button>
            </div>
          )}

          {/* Replaces the buy row when there is nothing to buy. The waiting
              list is the only useful action on a sold-out page, so it takes
              the place rather than sitting below a disabled button nobody can
              press. */}
          {soldOut && <WaitlistForm product={p} />}

          {p.description_html && (
            <div className="mt-8">
              <h2 className="text-xs uppercase tracking-widest text-stone-400">{t('product', 'description')}</h2>
              <div className="rich-text mt-2" dangerouslySetInnerHTML={{ __html: p.description_html }} />
            </div>
          )}

          {!p.description_html && p.description && (
            <div className="mt-8">
              <h2 className="text-xs uppercase tracking-widest text-stone-400">{t('product', 'description')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-700">{p.description}</p>
            </div>
          )}

          {/* Only rendered when the API says a description exists in another
              language, so this is either a real choice or nothing at all. */}
          <TranslatedDescription translations={p.description_translations} />

        </div>
      </div>

      {data.related?.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 font-serif text-2xl text-noir">{t('home', 'related')}</h2>
          <ProductGrid products={data.related} />
        </section>
      )}
    </div>
  )
}

/**
 * schema.org Product, so the price and availability can surface in results
 * instead of only on the page.
 *
 * `canonical` comes from the API as an absolute storefront URL, which is what
 * makes the @id stable — an id relative to the current host would point at a
 * different product on the API domain.
 */
function productJsonLd(p, locale) {
  // A product's categories arrive as {id, slug, name} with no canonical, so a
  // breadcrumb built from that field alone ships a ListItem with no `item` — an
  // entry a crawler is meant to reject. The slug rebuilds the same URL.
  const categoryUrl = (c) => c.canonical || absolute(`/${locale}/categories/${c.slug}`)

  const graph = [
    {
      '@type': 'Product',
      '@id': `${p.canonical}#product`,
      name: p.name,
      description: p.seo?.description,
      sku: p.sku || undefined,
      image: p.image?.url,
      brand: p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined,
      offers: {
        '@type': 'Offer',
        url: p.canonical,
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

  // The breadcrumb is already on the page above the gallery; serialising it
  // means the category path can appear under the result rather than only
  // inside the site.
  const categories = p.categories ?? [];
  if (categories.length) {
    graph.unshift({
      '@type': 'BreadcrumbList',
      '@id': `${p.canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: categories[0].name, item: categoryUrl(categories[0]) },
        ...categories.slice(1).map((c, i) => ({
          '@type': 'ListItem',
          position: i + 2,
          name: c.name,
          item: categoryUrl(c),
        })),
        { '@type': 'ListItem', position: categories.length + 1, name: p.name, item: p.canonical },
      ],
    })
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}
