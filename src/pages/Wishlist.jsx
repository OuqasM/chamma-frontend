import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import AddToCartButton from '../components/AddToCartButton'
import { imageUrl } from '../lib/api'
import { Price } from '../components/Price'
import { EmptyState } from '../components/Spinner'

export default function Wishlist() {
  const { locale, t, wishlist, toggleWishlist } = useApp()

  if (wishlist.length === 0) {
    return (
      <EmptyState
        title={t('common', 'wishlist')}
        action={
          <Link
            to={`/${locale}/products`}
            className="inline-block bg-noir px-7 py-3 text-xs uppercase tracking-widest text-white hover:bg-gold"
          >
            {t('nav', 'shop')}
          </Link>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-serif text-3xl text-noir">{t('common', 'wishlist')}</h1>

      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
        {wishlist.map((item) => (
          <article key={item.id} className="group">
            <Link to={`/${locale}/products/${item.slug}`} className="block overflow-hidden bg-ivory">
              <img
                src={imageUrl(item.image)}
                alt=""
                className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </Link>
            <h3 className="mt-3 font-serif text-base">
              <Link to={`/${locale}/products/${item.slug}`} className="hover:text-gold">{item.name}</Link>
            </h3>
            <Price product={item} className="mt-1 block text-sm" />
            <div className="mt-2 flex gap-2">
              <AddToCartButton
                product={item}
                className="flex-1 border border-noir/20 py-1.5 text-center text-xs uppercase tracking-widest hover:border-gold hover:bg-gold hover:text-white"
                activeClassName="border-jade bg-jade text-white hover:border-jade hover:bg-gold"
              />
              <button
                onClick={() => toggleWishlist(item)}
                className="border border-stone-200 px-3 text-xs text-stone-400 hover:border-rose-300 hover:text-rose-600"
              >
                {t('cart', 'remove')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
