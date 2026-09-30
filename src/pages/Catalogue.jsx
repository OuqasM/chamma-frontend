import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useApp } from '../context/AppContext'
import { absolute } from '../lib/seo'
import { ProductGrid } from '../components/ProductCard'
import { Spinner, ErrorState, EmptyState } from '../components/Spinner'
import useSeo from '../hooks/useSeo'

const SORTS = ['featured', 'newest', 'price_asc', 'price_desc', 'name']

/**
 * Category / brand / price, as a column on desktop and a slide-over panel on
 * small screens — a long list of every brand is not something to push a phone
 * user past before they reach a single product.
 */
function Filters({ category, brand, minPrice, maxPrice, bounds, onSelect, onClear, onClose }) {
  const { t, nav } = useApp()

  // The price fields are typed into, so they are committed on a pause: a
  // request per keystroke would flood the catalogue endpoint.
  const [min, setMin] = useState(minPrice)
  const [max, setMax] = useState(maxPrice)

  useEffect(() => setMin(minPrice), [minPrice])
  useEffect(() => setMax(maxPrice), [maxPrice])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (min !== minPrice) onSelect('min_price', min)
      if (max !== maxPrice) onSelect('max_price', max)
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max])

  return (
    <div className="space-y-7 text-sm">
      <div>
        <p className="text-xs uppercase tracking-widest text-stone-400">{t('nav', 'categories')}</p>
        <ul className="mt-2 space-y-1.5">
          <li>
            <button
              onClick={() => onSelect('category', '')}
              className={`hover:text-gold ${!category ? 'font-semibold text-gold' : 'text-stone-600'}`}
            >
              {t('home', 'viewAll')}
            </button>
          </li>
          {nav?.categories?.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onSelect('category', c.slug)}
                className={`hover:text-gold ${category === c.slug ? 'font-semibold text-gold' : 'text-stone-600'}`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-stone-400">{t('nav', 'brands')}</p>
        <ul className="mt-2 space-y-1.5">
          {nav?.brands?.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => onSelect('brand', b.slug)}
                className={`hover:text-gold ${brand === b.slug ? 'font-semibold text-gold' : 'text-stone-600'}`}
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-stone-400">{t('product', 'price')}</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder={bounds ? String(Math.floor(bounds.min)) : '0'}
            aria-label={`${t('product', 'price')} min`}
            className="w-full border border-stone-200 bg-ivory px-2 py-1.5 text-xs outline-none focus:border-gold"
          />
          <span aria-hidden="true" className="text-stone-400">–</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder={bounds ? String(Math.ceil(bounds.max)) : '0'}
            aria-label={`${t('product', 'price')} max`}
            className="w-full border border-stone-200 bg-ivory px-2 py-1.5 text-xs outline-none focus:border-gold"
          />
        </div>
        {bounds && (
          <p className="mt-1.5 text-[11px] text-stone-400">
            {bounds.count} · {bounds.min}–{bounds.max} MAD
          </p>
        )}
      </div>

      {onClose && (
        <div className="flex items-center gap-3 border-t border-stone-200 pt-4">
          <button
            onClick={onClear}
            className="flex-1 border border-stone-200 py-2.5 text-xs uppercase tracking-widest text-stone-500 hover:border-stone-400"
          >
            {t('common', 'clearAll')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-noir py-2.5 text-xs uppercase tracking-widest text-white hover:bg-gold"
          >
            {t('common', 'apply')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Catalogue({ mode = 'all', fixedCategory, fixedBrand }) {
  const { locale, t, nav } = useApp()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const query = useMemo(() => {
    const q = {
      page: params.get('page') || 1,
      per_page: params.get('per_page') || 24,
      sort: params.get('sort') || (mode === 'offers' ? 'featured' : 'featured'),
      q: params.get('q') || undefined,
      category: fixedCategory || params.get('category') || undefined,
      brand: fixedBrand || params.get('brand') || undefined,
      is_new: params.get('is_new') || undefined,
      min_price: params.get('min_price') || undefined,
      max_price: params.get('max_price') || undefined,
    }
    return q
  }, [params, mode, fixedCategory, fixedBrand])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const fetcher = mode === 'offers' ? api.offers : mode === 'search' ? api.search : api.products

    fetcher(locale, query, { signal: controller.signal })
      .then((d) => {
        // Catalogue endpoints all answer with a paginator; normalise anyway.
        setData(Array.isArray(d) ? { data: d, meta: null } : d)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [locale, query, mode])

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === null || value === undefined) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const products = data?.data || []
  const meta = data?.meta
  const bounds = meta?.bounds

  const clearFilters = () => {
    const next = new URLSearchParams(params)
    ;['category', 'brand', 'min_price', 'max_price'].forEach((k) => next.delete(k))
    next.delete('page')
    setParams(next, { replace: true })
  }

  // Escape and a tap on the scrim close the panel; the list keeps filtering
  // live behind it.
  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e) => e.key === 'Escape' && setFiltersOpen(false)
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [filtersOpen])

  const hasFilters = Boolean(query.category || query.brand || query.min_price || query.max_price)
  const activeCount = [query.category, query.brand, query.min_price, query.max_price].filter(Boolean).length
  const showSidebar = !fixedCategory && !fixedBrand

  const title =
    mode === 'offers'
      ? t('nav', 'offers')
      : mode === 'search'
        ? `${t('nav', 'search')}: ${params.get('q') || ''}`
        : query.is_new
          ? t('nav', 'new')
          : t('nav', 'shop')

  const isSearch = mode === 'search'

  // Every listing view of the same products is one page as far as a crawler is
  // concerned. Search is the exception: it is noindex because the result set
  // changes with every query and there is nothing stable to rank.
  useSeo({
    title: `${title} | Chamma Store`,
    description: isSearch ? undefined : t('seo', mode === 'offers' ? 'offersDescription' : 'shopDescription'),
    canonical: absolute(isSearch ? `/${locale}/products` : `/${locale}/${mode === 'offers' ? 'offers' : 'products'}`),
    alternates: isSearch
      ? undefined
      : {
          fr: absolute(`/fr/${mode === 'offers' ? 'offers' : 'products'}`),
          ar: absolute(`/ar/${mode === 'offers' ? 'offers' : 'products'}`),
          en: absolute(`/en/${mode === 'offers' ? 'offers' : 'products'}`),
        },
    noindex: isSearch,
  })

  const filterProps = {
    category: query.category || '',
    brand: query.brand || '',
    minPrice: params.get('min_price') || '',
    maxPrice: params.get('max_price') || '',
    bounds,
    onSelect: setParam,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-serif text-3xl text-noir">{title}</h1>

      <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
        {showSidebar && (
          <aside className="hidden md:block">
            <Filters {...filterProps} onClear={clearFilters} />
          </aside>
        )}

        <div>
          <div className="mb-6 flex items-center justify-between gap-3 border-b border-stone-200 pb-3 text-xs">
            {showSidebar && (
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="flex items-center gap-2 border border-stone-200 px-3 py-1.5 uppercase tracking-widest text-stone-600 md:hidden"
              >
                <span aria-hidden="true">☰</span>
                {t('common', 'filters')}
                {activeCount > 0 && (
                  <span className="rounded-full bg-gold px-1.5 text-[10px] text-white">{activeCount}</span>
                )}
              </button>
            )}

            <span className={`text-stone-500 ${showSidebar ? 'hidden md:inline' : ''}`}>
              {meta?.total ?? products.length}
            </span>

            <label className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-widest text-stone-400">Sort</span>
              <select
                value={params.get('sort') || 'featured'}
                onChange={(e) => setParam('sort', e.target.value)}
                className="border border-stone-200 bg-ivory px-2 py-1 outline-none focus:border-gold"
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
          </div>

          {hasFilters && showSidebar && (
            <div className="mb-4 flex flex-wrap items-center gap-2 md:hidden">
              {[
                [query.category, nav?.categories?.find((c) => c.slug === query.category)?.name],
                [query.brand, nav?.brands?.find((b) => b.slug === query.brand)?.name],
              ].map(([slug, label], i) =>
                slug ? (
                  <button
                    key={i}
                    onClick={() => setParam(i === 0 ? 'category' : 'brand', '')}
                    className="flex items-center gap-1.5 border border-stone-200 bg-ivory px-2.5 py-1 text-[11px] text-stone-600"
                  >
                    {label} <span aria-hidden="true">✕</span>
                  </button>
                ) : null,
              )}
              {query.min_price && (
                <button
                  onClick={() => setParam('min_price', '')}
                  className="border border-stone-200 bg-ivory px-2.5 py-1 text-[11px] text-stone-600"
                >
                  ≥ {query.min_price} ✕
                </button>
              )}
              {query.max_price && (
                <button
                  onClick={() => setParam('max_price', '')}
                  className="border border-stone-200 bg-ivory px-2.5 py-1 text-[11px] text-stone-600"
                >
                  ≤ {query.max_price} ✕
                </button>
              )}
            </div>
          )}

          {error && <ErrorState message={error} />}
          {loading && !data && <Spinner label={t('common', 'loading')} />}
          {!loading && !error && products.length === 0 && <EmptyState title={t('common', 'empty')} />}

          {products.length > 0 && <ProductGrid products={products} />}

          {meta?.links && meta.links.length > 2 && (
            <nav className="mt-12 flex flex-wrap justify-center gap-1.5" aria-label="Pagination">
              {meta.links.map((link, i) =>
                link.url ? (
                  <button
                    key={i}
                    onClick={() => setParam('page', new URL(link.url, window.location.origin).searchParams.get('page'))}
                    disabled={link.active}
                    className={`min-w-9 border px-3 py-1.5 text-xs ${
                      link.active ? 'border-gold bg-gold text-white' : 'border-stone-200 hover:border-gold'
                    }`}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                  />
                ) : (
                  <span
                    key={i}
                    className="min-w-9 border border-stone-100 px-3 py-1.5 text-center text-xs text-stone-300"
                    dangerouslySetInnerHTML={{ __html: link.label }}
                  />
                ),
              )}
            </nav>
          )}
        </div>
      </div>

      {/* Portalled so a filtered or transformed wrapper can never turn the
          panel into a box-sized overlay. */}
      {filtersOpen &&
        createPortal(
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label={t('common', 'close')}
            onClick={() => setFiltersOpen(false)}
            className="absolute inset-0 bg-noir/40"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('common', 'filters')}
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-ivory p-5 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" aria-hidden="true" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-[0.3em] text-noir">{t('common', 'filters')}</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label={t('common', 'close')}
                className="text-lg leading-none text-stone-500"
              >
                ✕
              </button>
            </div>

            <Filters {...filterProps} onClear={clearFilters} onClose={() => setFiltersOpen(false)} />
          </div>
        </div>,
          document.body,
        )}
    </div>
  )
}
