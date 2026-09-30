import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { imageUrl } from '../lib/api'
import { formatPrice } from '../lib/format'
import { EmptyState } from '../components/Spinner'

export default function Cart() {
  const { locale, t, cart, setQuantity, removeFromCart, cartSubtotal } = useApp()

  if (cart.length === 0) {
    return (
      <EmptyState
        title={t('cart', 'empty')}
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-serif text-3xl text-noir">{t('cart', 'title')}</h1>

      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_300px]">
        <ul className="divide-y divide-stone-200 border-y border-stone-200">
          {cart.map((line) => (
            <li key={line.id} className="flex gap-4 py-5">
              <Link to={`/${locale}/products/${line.slug}`} className="w-20 shrink-0 overflow-hidden bg-ivory">
                {imageUrl(line.image) && (
                  <img src={imageUrl(line.image)} alt="" className="aspect-[4/5] w-full object-cover" />
                )}
              </Link>

              <div className="flex flex-1 flex-col">
                <Link to={`/${locale}/products/${line.slug}`} className="font-serif text-base hover:text-gold">
                  {line.name}
                </Link>
                <p className="mt-0.5 text-xs text-stone-500">{formatPrice(line.price, locale)}</p>

                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center border border-stone-200 text-xs">
                    <button onClick={() => setQuantity(line.id, line.quantity - 1)} className="px-3 py-1.5 hover:text-gold" aria-label="-">−</button>
                    <span className="min-w-8 text-center">{line.quantity}</span>
                    <button
                      onClick={() => setQuantity(line.id, line.quantity + 1)}
                      disabled={line.stock != null && line.quantity >= line.stock}
                      className="px-3 py-1.5 hover:text-gold disabled:opacity-30"
                      aria-label="+"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(line.id)}
                    className="text-xs text-stone-400 underline hover:text-rose-700"
                  >
                    {t('cart', 'remove')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit border border-stone-200 bg-ivory p-6">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">{t('cart', 'subtotal')}</dt>
              <dd>{formatPrice(cartSubtotal, locale)}</dd>
            </div>
          </dl>

          <Link
            to={`/${locale}/checkout`}
            className="mt-5 block bg-noir py-3 text-center text-xs uppercase tracking-widest text-white transition hover:bg-gold"
          >
            {t('cart', 'checkout')}
          </Link>
          <Link
            to={`/${locale}/products`}
            className="mt-3 block text-center text-xs text-stone-500 underline hover:text-gold"
          >
            {t('common', 'continue')}
          </Link>
        </aside>
      </div>
    </div>
  )
}
