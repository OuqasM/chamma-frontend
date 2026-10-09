import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, imageUrl } from '../lib/api'
import { useApp } from '../context/AppContext'
import { ProductCard } from '../components/ProductCard'
import Carousel from '../components/Carousel'
import { Spinner, ErrorState } from '../components/Spinner'
import useSeo from '../hooks/useSeo'
import { absolute, organisationJsonLd } from '../lib/seo'

function Section({ title, action, children }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-2xl text-noir">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** The "view all" affordance beside a section heading.
 *
 *  It was a 12px gold word that only announced itself on hover, which read as
 *  a caption rather than as the way into the rest of the shelf. It now carries
 *  the weight of a heading counterpart: the label in `noir` so it holds its own
 *  against the serif title, a gold rule that is always drawn rather than grown
 *  on hover, and an arrow that mirrors with the writing direction — the same
 *  forward cue the brand tiles use, so the page has one idea of "onward". */
function ViewAllLink({ to, children }) {
  const { dir } = useApp()
  const arrow = dir === 'rtl' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'

  return (
    <Link
      to={to}
      className="group inline-flex shrink-0 items-center gap-2 border-b border-gold pb-1 text-sm font-medium uppercase tracking-[0.18em] text-noir transition-colors hover:text-gold"
    >
      {children}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      >
        <path d={arrow} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

/** Reference-style brand card: full-bleed image + dark overlay, name
 *  bottom-left and a white pill "Discover" CTA inside the frame, whole tile
 *  links to the brand — the same treatment the category card used. The image
 *  is cropped to fill a fixed ratio, so every tile is the same size whatever
 *  the uploaded photo's own dimensions are. */
function BrandCard({ brand, discoverLabel }) {
  const { locale, dir } = useApp()
  const image = imageUrl(brand.logo)
  const href = `/${locale}/brands/${brand.slug}`
  // Forward affordance: points right in LTR, and mirrors to point left in RTL
  // so it always reads as "onward" in the direction the reader scans.
  const arrow = dir === 'rtl' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'

  return (
    <Link to={href} className="group relative block w-full overflow-hidden bg-ivory">
      <div className="relative aspect-[4/3]">
        {image ? (
          <img
            src={image}
            alt={brand.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-300">Chamma</div>
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-6 sm:p-7">
          <h3 className="font-serif text-lg leading-snug text-white sm:text-xl">
            {brand.name}
          </h3>
          <span className="inline-flex items-center gap-2 rounded-full border border-white px-5 py-2 text-[11px] uppercase tracking-widest text-white transition group-hover:bg-ivory group-hover:text-noir">
            {discoverLabel}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
              <path d={arrow} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

/** A row of products that scrolls sideways instead of wrapping.
 *
 *  The home page sends exactly four products per shelf, and this is the same
 *  treatment "Parfumez par marque" gets, so the page reads as one set of rules
 *  rather than a grid that changed halfway down.
 *
 *  It autoplays on a phone, where a single card on screen that moves by itself
 *  is the only signal that there is another one, and stands still from `lg` up,
 *  where four cards already fit on screen and moving them under a shopper
 *  comparing prices is just in the way. */
function ProductShelf({ products, label }) {
  return (
    <Carousel
      items={products}
      ariaLabel={label}
      autoplay={2500}
      autoplayBelow={1024}
      perViewClass="[--pv:1] sm:[--pv:2] lg:[--pv:4]"
      renderItem={(p) => <ProductCard product={p} />}
    />
  )
}

export default function Home() {
  const { locale, t } = useApp()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    api
      .home(locale)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [locale])

  useSeo({
    title: t('seo', 'siteName'),
    description: t('seo', 'homeDescription'),
    image: data?.hero?.image,
    // Home has no alternates of its own: it is the x-default target, so all
    // three locales point back here rather than at each other.
    alternates: { fr: absolute('/fr'), ar: absolute('/ar'), en: absolute('/en') },
    canonical: absolute(`/${locale}`),
    jsonLd: data ? organisationJsonLd(data, locale) : null,
  })

  if (error) return <ErrorState message={error} />
  if (!data) return <Spinner label={t('common', 'loading')} />

  // A brand without a logo has nothing to show in a logo tile, so it is left
  // out rather than rendered as an empty placeholder.
  const brandTiles = (data.brands || []).filter((b) => b.logo)

  return (
    <>
      <section className="relative isolate overflow-hidden bg-noir">
        {/* Two artworks, each cropped for the shape it is shown in: a portrait
            photo (1080x1920) on small screens, where a tall frame suits it,
            and a landscape one (1536x1024) from `sm` up, where a wide frame
            does. `<picture>` swaps them, so neither is ever stretched to fit
            the wrong aspect ratio. `.hero-art` owns the fit and the focal
            point. */}
        <picture>
          <source media="(min-width: 640px)" srcSet="/hero/hero-desktop.jpg" />
          <img
            src="/hero/hero-mobile.jpg"
            alt=""
            aria-hidden="true"
            className="hero-art absolute -z-20"
          />
        </picture>
        {/* Scrim: a uniform dim for general contrast plus a directional wash
            that deepens under the copy, which always sits on the inline-start
            side. Mirrored for Arabic. */}
        <div className="absolute inset-0 -z-10 bg-noir/40" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-l from-transparent via-noir/30 to-noir/80 rtl:bg-gradient-to-r" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-28">
          <div className="max-w-xl">
            {data.hero?.eyebrow && (
              <p className="text-xs uppercase tracking-[0.3em] text-stone-300">{data.hero.eyebrow}</p>
            )}
            <h1 className="mt-3 font-serif text-4xl leading-tight text-white md:text-5xl">
              Chamma Store
            </h1>
            <div className="mt-7 flex gap-3">
              <Link
                to={`/${locale}/products`}
                className="bg-ivory px-7 py-3 text-xs uppercase tracking-widest text-noir transition hover:bg-gold hover:text-white"
              >
                {t('nav', 'shop')}
              </Link>
              <Link
                to={`/${locale}/offers`}
                className="border border-white/40 px-7 py-3 text-xs uppercase tracking-widest text-white transition hover:border-white"
              >
                {t('nav', 'offers')}
              </Link>
            </div>

            {data.promises && (
              <ul className="mt-9 space-y-1.5 text-xs text-stone-200">
                {data.promises.original && <li>• {data.promises.original}</li>}
                {data.promises.nationwide && <li>• {data.promises.nationwide}</li>}
                {data.promises.cod && <li>• {data.promises.cod}</li>}
                {data.promises.estimate && <li>• {data.promises.estimate}</li>}
              </ul>
            )}
          </div>
        </div>
      </section>

      {brandTiles.length > 0 && (
        <Section title={t('home', 'shopByBrand')}>
          <Carousel
            items={brandTiles}
            ariaLabel={t('home', 'shopByBrand')}
            autoplay={2500}
            perViewClass="[--pv:1] sm:[--pv:2] lg:[--pv:3]"
            renderItem={(b) => <BrandCard brand={b} discoverLabel={t('home', 'discover')} />}
          />
        </Section>
      )}

      {data.best_sellers?.length > 0 && (
        <Section
          title={t('home', 'topSellers')}
          action={<ViewAllLink to={`/${locale}/products`}>{t('home', 'viewAll')}</ViewAllLink>}
        >
          <ProductShelf products={data.best_sellers} label={t('home', 'topSellers')} />
        </Section>
      )}

      {data.new_arrivals?.length > 0 && (
        <Section
          title={t('home', 'newArrivals')}
          action={<ViewAllLink to={`/${locale}/products?sort=newest`}>{t('home', 'viewAll')}</ViewAllLink>}
        >
          <ProductShelf products={data.new_arrivals} label={t('home', 'newArrivals')} />
        </Section>
      )}

      {data.offers?.length > 0 && (
        <Section
          title={t('home', 'offers')}
          action={<ViewAllLink to={`/${locale}/offers`}>{t('home', 'viewAll')}</ViewAllLink>}
        >
          <ProductShelf products={data.offers} label={t('home', 'offers')} />
        </Section>
      )}
    </>
  )
}
