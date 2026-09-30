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
      {/* No frame and no panel. The photography is shot on white, so anything
          painted behind it reads as a mismatched rectangle inside the card —
          which is exactly what the earlier `border + bg-ivory` frame did once
          the page itself went cream. With a white ground the photo needs no
          help to read as an object; the interest comes from type and the two
          hover cues instead. `overflow-hidden` stays on the image link so the
          zoom is clipped to the image box. */}
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
            <span className="absolute start-0 top-3 bg-sale px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
              -{product.discount_percent}%
            </span>
          )}
          {product.is_new && product.discount_percent <= 0 && (
            <span className="absolute start-0 top-3 bg-jade px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
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

      {/* Wishlist sits on the photograph, where a shopper looks first. There is
          deliberately no filled pill behind it: that would put a panel back over
          the photo, which is the thing this card just stopped doing. The hairline
          ring is what defines it on a white image, and the gold fill is reserved
          for the selected state so it reads as a choice rather than as chrome. */}
      <button
        type="button"
        onClick={() => toggleWishlist(product)}
        aria-label={t('product', 'addToWishlist')}
        aria-pressed={wished}
        className={`absolute end-0 top-3 flex h-9 w-9 items-center justify-center rounded-full border text-sm leading-none transition ${
          wished ? 'border-gold bg-gold text-white' : 'border-stone-200 text-stone-400 hover:border-gold hover:text-gold'
        }`}
      >
        {wished ? '♥' : '♡'}
      </button>

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
          {/* `nav-link` is the header's own hover cue — a hairline growing from
              the inline-start edge — reused so the card reads as the same family
              rather than inventing a third underline treatment. */}
          <Link to={href} className="nav-link transition hover:text-gold">
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
