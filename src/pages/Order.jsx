import { useEffect, useState } from 'react'
import BankSlipImage from '../components/BankSlipImage'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { api, imageUrl } from '../lib/api'
import { useApp } from '../context/AppContext'
import { formatPrice } from '../lib/format'
import { Spinner, ErrorState } from '../components/Spinner'

export function OrderConfirmation() {
  const { reference } = useParams()
  const [params] = useSearchParams()
  const { state } = useLocation()
  const { locale, t } = useApp()

  const [order, setOrder] = useState(state?.order || null)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(state?.message || null)

  // Refetch on a cold load (refresh / shared link); the reference + phone pair
  // is the only thing that authorises reading an order.
  useEffect(() => {
    if (order || !reference) return
    const phone = params.get('phone') || ''
    api
      .order(locale, reference, phone)
      .then((d) => setOrder(d.order))
      .catch((e) => setError(e.message))
  }, [order, reference, params, locale])

  if (error) return <ErrorState message={error} />
  if (!order) return <Spinner label={t('common', 'loading')} />

  const instructions = order.payment_instructions

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-jade">{order.payment_method_label || t('checkout', 'payment')}</p>

      <h1 className="mt-3 font-serif text-3xl text-noir">
        {message || t('checkout', 'success', { reference: order.reference })}
      </h1>

      <p className="mt-4 font-mono text-lg tracking-widest text-gold">{order.reference}</p>

      <dl className="mx-auto mt-8 max-w-sm space-y-1.5 border-y border-stone-200 py-5 text-sm text-start">
        <div className="flex justify-between">
          <dt className="text-stone-500">{t('cart', 'subtotal')}</dt>
          <dd>{formatPrice(order.subtotal, locale)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-stone-500">{t('cart', 'shipping')}</dt>
          <dd>{order.shipping_cost === 0 ? t('common', 'free') : formatPrice(order.shipping_cost, locale)}</dd>
        </div>
        <div className="flex justify-between font-medium">
          <dt>{t('cart', 'total')}</dt>
          <dd>{formatPrice(order.total, locale)}</dd>
        </div>
      </dl>

      {instructions && (
        // The third step of the transfer flow on the checkout page, now
        // unlocked. The order exists, the reference is real, and the link
        // carries it — so what arrives on WhatsApp is something the store can
        // match to a row in its own orders list.
        <section className="mx-auto mt-10 max-w-sm overflow-hidden border border-jade/40 bg-ivory text-start">
          <header className="border-b border-jade/25 bg-jade/10 px-5 py-3">
            <p className="text-xs uppercase tracking-widest text-jade">{t('checkout', 'transferBadge')}</p>
            <h2 className="mt-1 font-serif text-lg text-noir">{t('checkout', 'bank_transfer')}</h2>
          </header>

          <div className="p-5">
          <dl className="space-y-1 text-xs">
            {instructions.holder && (
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">{t('checkout', 'bankHolder')}</dt>
                <dd className="text-end">{instructions.holder}</dd>
              </div>
            )}
            {instructions.bank && (
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">{t('checkout', 'bankName')}</dt>
                <dd className="text-end">{instructions.bank}</dd>
              </div>
            )}
            {instructions.rib && (
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">RIB</dt>
                <dd className="text-end font-mono">{instructions.rib}</dd>
              </div>
            )}
            {instructions.iban && (
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">IBAN</dt>
                <dd className="text-end break-all font-mono">{instructions.iban}</dd>
              </div>
            )}
          </dl>

          <BankSlipImage image={instructions.image} />

          <a
            href={instructions.whatsapp_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 bg-jade py-3.5 text-center text-xs uppercase tracking-widest text-white transition hover:bg-noir"
          >
            {t('checkout', 'sendReceipt')}
          </a>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-400">{instructions.message}</p>
          </div>
        </section>
      )}

      <Link
        to={`/${locale}/products`}
        className="mt-8 inline-block bg-noir px-7 py-3 text-xs uppercase tracking-widest text-white transition hover:bg-gold"
      >
        {t('common', 'continue')}
      </Link>
    </div>
  )
}

export function OrderLookup() {
  const { locale, t } = useApp()
  const [reference, setReference] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOrder(null)
    try {
      const d = await api.order(locale, reference.trim(), phone.trim())
      setOrder(d.order)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-center font-serif text-3xl text-noir">{t('order', 'lookup')}</h1>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block">
          <span className="font-semibold text-xs uppercase tracking-widest text-stone-400">{t('order', 'reference')}</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
            placeholder="CP-0000-0000"
            className="mt-1.5 w-full border border-stone-200 bg-ivory px-3 py-2.5 text-sm outline-none focus:border-gold"
          />
        </label>
        <label className="block">
          <span className="font-semibold text-xs uppercase tracking-widest text-stone-400">{t('checkout', 'phone')}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputMode="tel"
            className="mt-1.5 w-full border border-stone-200 bg-ivory px-3 py-2.5 text-sm outline-none focus:border-gold"
          />
        </label>

        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-noir py-3 text-xs uppercase tracking-widest text-white transition hover:bg-gold disabled:opacity-50"
        >
          {busy ? t('common', 'loading') : t('order', 'track')}
        </button>
      </form>

      {order && (
        <div className="mt-10 border border-stone-200 bg-ivory p-6">
          <p className="font-mono text-sm text-gold">{order.reference}</p>
          <p className="mt-1 font-serif text-lg text-noir">{order.status_label}</p>
          <p className="mt-3 text-sm text-stone-600">
            {order.customer?.name} · {formatPrice(order.total, locale)}
          </p>
          <ul className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-xs text-stone-600">
            {order.items?.map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                {imageUrl(item.image_url || item.image) && (
                  <img src={imageUrl(item.image_url || item.image)} alt="" className="h-12 w-10 object-cover" />
                )}
                <span className="flex-1">{item.product_name}</span>
                <span className="text-stone-400">×{item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function NotFound() {
  const { locale, t } = useApp()
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="font-serif text-6xl text-sand">404</p>
      <h1 className="mt-4 font-serif text-2xl text-noir">{t('notFound', 'title')}</h1>
      <p className="mt-2 text-sm text-stone-500">{t('notFound', 'body')}</p>
      <Link
        to={`/${locale}`}
        className="mt-8 inline-block bg-noir px-7 py-3 text-xs uppercase tracking-widest text-white hover:bg-gold"
      >
        {t('nav', 'home')}
      </Link>
    </div>
  )
}
