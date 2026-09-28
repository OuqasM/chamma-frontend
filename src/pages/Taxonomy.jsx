import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, imageUrl } from '../lib/api'
import { useApp } from '../context/AppContext'
import { ProductGrid } from '../components/ProductCard'
import { Spinner, ErrorState } from '../components/Spinner'

export default function Taxonomy({ kind }) {
  const { slug } = useParams()
  const { locale, t } = useApp()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError(null)

    const fetcher = kind === 'brands' ? api.brand : api.category
    fetcher(locale, slug, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message)
      })

    return () => controller.abort()
  }, [locale, slug, kind])

  if (error) return <ErrorState message={error} />
  if (!data) return <Spinner label={t('common', 'loading')} />

  // The paginator carries the entity alongside the product rows.
  const entity = data.meta?.[kind === 'brands' ? 'brand' : 'category']
  const products = data.data || []
  const hero = imageUrl(entity?.image?.url)

  return (
    <div className="pb-10">
      {/* Same treatment as the home hero: the category photo runs edge to edge
          behind a scrim, with the name and copy in white on the inline-start
          side. When the category has no image the plain light header is used
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
      </div>
    </div>
  )
}
