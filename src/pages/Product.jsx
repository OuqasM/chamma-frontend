import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, imageUrl } from '../lib/api'
import { useApp } from '../context/AppContext'
import { Price } from '../components/Price'
import { ProductGrid } from '../components/ProductCard'
import { Spinner, ErrorState } from '../components/Spinner'

export default function Product() {
  const { slug } = useParams()
  const { locale, t, addToCart, toggleWishlist, inWishlist } = useApp()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError(null)
    setQuantity(1)
    setActive(0)

    api
      .product(locale, slug, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message)
      })

    return () => controller.abort()
  }, [locale, slug])

  if (error) return <ErrorState message={error} />
  if (!data) return <Spinner label={t('common', 'loading')} />

  const p = data.product
  const gallery = p.images?.length ? p.images : p.image ? [p.image] : []
  const soldOut = !p.in_stock
  const wished = inWishlist(p.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <nav className="mb-8 text-xs text-stone-400">
        <Link to={`/${locale}`} className="hover:text-gold">{t('nav', 'home')}</Link>
        {p.category && (
          <>
            {' / '}
            <Link to={`/${locale}/categories/${p.category.slug}`} className="hover:text-gold">
              {p.category.name}
            </Link>
          </>
        )}
        {' / '}
        <span className="text-stone-600">{p.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <div className="overflow-hidden bg-ivory">
            {gallery[active] ? (
              <img
                src={imageUrl(gallery[active].url)}
                alt={gallery[active].alt || p.name}
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center text-stone-300">Chamma</div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2">
              {gallery.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`w-16 overflow-hidden border ${i === active ? 'border-gold' : 'border-transparent'}`}
                  aria-label={`${t('product', 'details')} ${i + 1}`}
                >
                  <img src={imageUrl(img.url)} alt="" className="aspect-[4/5] w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {p.brand && (
            <Link to={`/${locale}/brands/${p.brand.slug}`} className="text-xs uppercase tracking-[0.25em] text-stone-500 hover:text-gold">
              {p.brand.name}
            </Link>
          )}

          <h1 className="mt-2 font-serif text-3xl leading-tight text-noir md:text-4xl">{p.name}</h1>

          {p.short_description && <p className="mt-3 text-sm leading-relaxed text-stone-600">{p.short_description}</p>}

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

              <button
                onClick={() => addToCart(p, quantity)}
                className="flex-1 bg-noir px-6 py-3 text-xs uppercase tracking-widest text-white transition hover:bg-gold"
              >
                {t('common', 'addToCart')}
              </button>

              <button
                onClick={() => toggleWishlist(p)}
                aria-label={t('product', 'addToWishlist')}
                className={`border px-4 text-lg transition ${wished ? 'border-gold text-gold' : 'border-stone-200 text-stone-400 hover:border-gold'}`}
              >
                {wished ? '♥' : '♡'}
              </button>
            </div>
          )}

          {p.description && (
            <div className="mt-8">
              <h2 className="text-xs uppercase tracking-widest text-stone-400">{t('product', 'description')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-700">{p.description}</p>
            </div>
          )}

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
