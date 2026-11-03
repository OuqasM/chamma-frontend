import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api, imageUrl, PER_PAGE } from '../lib/api'
import { useApp } from '../context/AppContext'
import { ProductGrid } from '../components/ProductCard'
import { Pagination } from '../components/Pagination'
import { Spinner, ErrorState } from '../components/Spinner'
import useSeo from '../hooks/useSeo'
import { absolute } from '../lib/seo'

export default function Taxonomy({ kind }) {
  const { slug } = useParams()
  const { locale, t } = useApp()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  // The page number rides the query string, like every other listing: it is
  // the one piece of a listing's state a shopper can paste into a message.
  const page = params.get('page') || '1'

  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError(null)

    const fetcher = kind === 'brands' ? api.brand : api.category
    fetcher(locale, slug, {
      signal: controller.signal,
      params: { page, per_page: PER_PAGE },
    })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message)
      })

    return () => controller.abort()
  }, [locale, slug, kind, page])

  // A page change is a different list of products, and it starts at the top.
  // `ScrollToTop` cannot see it: the page number is a query-string write on
  // the same pathname, which is the channel the filters use too — and those
  // must not yank the page. The first render is not a change: `ScrollToTop`
  // has already asked for the top on mount.
  const previousPage = useRef(null)
  useEffect(() => {
    if (previousPage.current === null) {
      previousPage.current = page
      return
    }
    if (previousPage.current === page) return
    previousPage.current = page
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [page])

  const setPage = (next) => {
    const nextParams = new URLSearchParams(params)
    if (!next || next === '1') nextParams.delete('page')
    else nextParams.set('page', next)
    setParams(nextParams, { replace: true })
  }

  const entity = data?.meta?.[kind === 'brands' ? 'brand' : 'category']

  useSeo({
    title: entity ? `${entity.seo?.title || entity.name} | ${t('seo', 'siteName')}` : t('seo', 'siteName'),
    description: entity?.seo?.description || entity?.description,
    // A brand carries a `logo`, not an `image`, so the brand page used to ship
    // no social preview at all. The logo is a better answer than nothing.
    image: entity?.image?.url || entity?.logo,
    canonical: entity?.canonical,
    alternates: entity?.alternates,
    jsonLd: entity ? breadcrumbJsonLd(entity, kind, locale) : null,
  })

  if (error) return <ErrorState message={error} />
  if (!data) return <Spinner label={t('common', 'loading')} />

  // The paginator carries the entity alongside the product rows.
  const products = data.data || []
  // A category publishes an `image`, a brand publishes a `logo`. Reading `image`
  // for both meant a brand header could never match and every brand fell through
  // to the bare heading.
  const hero = imageUrl(kind === 'brands' ? entity?.logo : entity?.image?.url)

  return (
    <div className="pb-10">
      {/* Same treatment as the home hero: the image runs edge to edge
          behind a scrim, with the name and copy in white on the inline-start
          side. When there is no image the plain light header is used
          instead, so the page still reads well. */}
      {hero ? (
        <header className="relative isolate overflow-hidden bg-noir">
          <img
            src={hero}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-noir/40" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-l from-transparent via-noir/30 to-noir/80 rtl:bg-gradient-to-r" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 md:py-24">
            <h1 className="max-w-2xl font-serif text-4xl leading-tight text-white md:text-5xl">
              {entity?.name}
            </h1>
            {entity?.tagline && (
              <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-200">
                {entity.tagline}
              </p>
            )}
            {entity?.description && (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-200">
                {entity.description}
              </p>
            )}
          </div>
        </header>
      ) : (
        <header className="mx-auto max-w-7xl px-4 pb-8 pt-10">
          <h1 className="font-serif text-3xl text-noir">{entity?.name}</h1>
          {entity?.tagline && <p className="mt-2 text-sm text-stone-600">{entity.tagline}</p>}
          {entity?.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
              {entity.description}
            </p>
          )}
        </header>
      )}

      <div className="mx-auto max-w-7xl px-4 py-10">
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <p className="py-16 text-center text-stone-500">{t('common', 'empty')}</p>
        )}

        {/* The page row. It was missing, and a brand with more products than
            fit on one page was showing only the first of them: the rest were
            in the API's answer and nowhere on the page. */}
        <Pagination meta={data?.meta} onPage={setPage} />
      </div>
    </div>
  )
}

/** Home → the listing itself, which is what a category result should show. */
function breadcrumbJsonLd(entity, kind, locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Chamma Store', item: absolute(`/${locale}`) },
      { '@type': 'ListItem', position: 2, name: entity.name, item: entity.canonical },
    ],
  }
}
