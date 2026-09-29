import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { imageUrl, productHref } from '../lib/api'
import { Price } from './Price'

export function ProductCard({ product, showAdd = true }) {
  const { locale, t, addToCart } = useApp()
  const image = imageUrl(product.image?.url)
  const href = productHref(product.url, locale)
  const soldOut = !product.in_stock

  return (
    <article className="group relative flex flex-col">
      <Link to={href} className="block overflow-hidden bg-ivory">
        <div className="relative aspect-[4/5]">
          {image ? (
            <img
              src={image}
              alt={product.image?.alt || product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-300">Chamma</div>
          )}

          {product.discount_percent > 0 && (
            <span className="absolute start-2 top-2 rounded-full bg-rose-700 px-2 py-0.5 text-xs font-medium text-white">
              -{product.discount_percent}%
            </span>
          )}
          {product.is_new && product.discount_percent <= 0 && (
            <span className="absolute start-2 top-2 rounded-full bg-jade px-2 py-0.5 text-xs font-medium text-white">
              {t('nav', 'new')}
            </span>
          )}
          {soldOut && (
            <span className="absolute inset-x-0 bottom-0 bg-noir/80 py-1.5 text-center text-xs text-white">
              {t('product', 'outOfStock')}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1 pt-3">
        {product.brand?.name && (
          <p className="truncate text-[11px] uppercase tracking-widest text-stone-400">{product.brand.name}</p>
        )}
        {/* Two lines are always reserved and the name is clamped to them. A long
            name on a narrow card would otherwise grow the text block and drag the
            price and button out of line with the cards beside it; the grid
            stretches the cards, but it cannot align what varies inside them. */}
        <h3 className="line-clamp-2 min-h-[2.75rem] font-serif text-base leading-snug text-noir">
          <Link to={href} className="hover:text-gold">
            {product.name}
          </Link>
        </h3>
        {product.size && <p className="truncate text-xs text-stone-400">{product.size}</p>}
        {/* mt-auto pins price and button to the bottom, so cards line up even
            when a brand or size line is missing. */}
        <Price product={product} className="mt-auto pt-1 text-sm font-medium" />

        {showAdd && !soldOut && (
          <button
            type="button"
            onClick={() => addToCart(product)}
            className="mt-2 w-full border border-noir/20 py-1.5 text-xs uppercase tracking-widest text-noir transition hover:border-gold hover:bg-gold hover:text-white"
          >
            {t('common', 'addToCart')}
          </button>
        )}
      </div>
    </article>
  )
}

export function ProductGrid({ products, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 ${className}`}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
