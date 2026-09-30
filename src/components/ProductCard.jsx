import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { imageUrl, productHref } from '../lib/api'
import { Price } from './Price'

export function ProductCard({ product, showAdd = true }) {
  const { locale, t, addToCart, toggleWishlist, inWishlist } = useApp()
  const image = imageUrl(product.image?.url)
  const href = productHref(product.url, locale)
  const soldOut = !product.in_stock
  const wished = inWishlist(product.id)

  return (
    <article className="group relative flex flex-col">
      {/* The frame is the main change: a hairline and a white ground behind the
          photograph, so the shot reads as a presented object rather than as a
          tile butted against the page. `overflow-hidden` sits on the image link
          *inside* the frame, so the hover zoom is clipped at the inner edge of
          the border and the 1px rule itself stays crisp. Putting it on the
          article instead would let the scaled image ride over the frame. */}
      <div className="relative border border-stone-200 bg-ivory transition duration-500 group-hover:border-stone-300">
        <Link to={href} className="block overflow-hidden">
          <div className="relative aspect-[4/5]">
            {image ? (
              <img
                src={image}
                alt={product.image?.alt || product.name}
                loading="lazy"
                className={`h-full w-full object-cover transition duration-700 group-hover:scale-[1.06] ${
                  soldOut ? 'opacity-70 saturate-50' : ''
                }`}
              />
            ) : (
              <div className="flex h-full items-center justify-center font-serif text-lg tracking-[0.3em] text-stone-300">
                Chamma
              </div>
            )}

            {product.discount_percent > 0 && (
              <span className="absolute start-3 top-3 bg-plum px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                -{product.discount_percent}%
              </span>
            )}
            {product.is_new && product.discount_percent <= 0 && (
              <span className="absolute start-3 top-3 bg-jade px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                {t('nav', 'new')}
              </span>
            )}
            {soldOut && (
              <span className="absolute inset-x-0 bottom-0 bg-noir/85 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                {t('product', 'outOfStock')}
              </span>
            )}
          </div>
        </Link>

        {/* Wishlist lives on the photograph rather than in the text block, which
            is where a shopper looks first. The filled state is the only place
            the accent is used as a fill here, so it reads as a selection. */}
        <button
          type="button"
          onClick={() => toggleWishlist(product)}
          aria-label={t('product', 'addToWishlist')}
          aria-pressed={wished}
          className={`absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border text-sm leading-none backdrop-blur transition ${
            wished
              ? 'border-gold bg-gold text-white'
              : 'border-stone-200 bg-ivory/85 text-stone-500 hover:border-gold hover:text-gold'
          }`}
        >
          {wished ? '♥' : '♡'}
        </button>
      </div>

      <div className="flex flex-1 flex-col pt-4">
        {product.brand?.name && (
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400 transition group-hover:text-gold">
            {product.brand.name}
          </p>
        )}
        {/* Two lines are always reserved and the name is clamped to them. A long
            name on a narrow card would otherwise grow the text block and drag the
            price and button out of line with the cards beside it; the grid
            stretches the cards, but it cannot align what varies inside them. */}
        <h3 className="mt-1.5 line-clamp-2 min-h-[2.75rem] font-serif text-lg leading-snug text-noir">
          <Link to={href} className="transition hover:text-gold">
            {product.name}
          </Link>
        </h3>
        {product.size && <p className="mt-1 truncate text-xs text-stone-400">{product.size}</p>}
        {/* mt-auto pins price and button to the bottom, so cards line up even
            when a brand or size line is missing. */}
        <Price product={product} className="mt-auto pt-3 text-sm font-medium" />

        {showAdd && !soldOut && (
          <button
            type="button"
            onClick={() => addToCart(product)}
            className="mt-3 w-full border border-noir/20 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-noir transition hover:border-gold hover:bg-gold hover:text-white"
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
