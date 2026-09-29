import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useApp } from '../context/AppContext'
import { formatPrice } from '../lib/format'
import { EmptyState } from '../components/Spinner'
import BankSlipImage from '../components/BankSlipImage'

const emptyForm = {
  name: '',
  phone: '',
  city: '',
  address: '',
  notes: '',
  // Filled from the API: the store decides which methods it accepts.
  payment_method: '',
}

export default function Checkout() {
  const { locale, t, cart, cartSubtotal, clearCart } = useApp()
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState(false)
  const [quote, setQuote] = useState(null)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [placing, setPlacing] = useState(false)

  const items = cart.map((l) => ({ product_id: l.id, quantity: l.quantity }))

  // The city list, the payment methods and the bank details all come from the
  // API: the storefront never hardcodes what the store can ship or take.
  useEffect(() => {
    let alive = true
    setOptionsError(false)
    api
      .checkoutOptions(locale)
      .then((d) => {
        if (!alive) return
        setOptions(d)
        setForm((f) => (f.payment_method ? f : { ...f, payment_method: d.payment?.default || 'cod' }))
      })
      .catch(() => alive && setOptionsError(true))
    return () => {
      alive = false
    }
  }, [locale])

  // Server-computed totals: the client never decides shipping or its own price.
  useEffect(() => {
    if (items.length === 0) return
    let alive = true
    api
      .quote(locale, { city: form.city, items })
      .then((d) => alive && setQuote(d))
      .catch(() => alive && setQuote(null))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, form.city, cart])

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((prev) => {
      if (!prev[key] && !prev.message) return prev
      const { message: _m, ...rest } = prev
      return { ...rest, [key]: undefined }
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setPlacing(true)
    setErrors({})
    setMessage(null)

    try {
      const res = await api.checkout(locale, {
        ...form,
        items,
        locale,
      })
      clearCart()
      navigate(`/${locale}/order/${res.order.reference}?phone=${encodeURIComponent(form.phone)}&new=1`, {
        replace: true,
        state: { message: res.message, order: res.order },
      })
    } catch (err) {
      setErrors(err.errors || {})
      setMessage(err.message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setPlacing(false)
    }
  }

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

  const field = (key, label, props = {}) => (
    <label className="block">
      <span className="font-semibold text-xs uppercase tracking-widest text-stone-400">{label}</span>
      <input
        value={form[key]}
        onChange={update(key)}
        {...props}
        className={`mt-1.5 w-full border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gold ${
          errors[key] ? 'border-rose-400' : 'border-stone-200'
        }`}
      />
      {errors[key] && <span className="mt-1 block text-xs text-rose-600">{errors[key][0]}</span>}
    </label>
  )

  const cities = options?.cities || []
  const methods = options?.payment_methods || []
  const isTransfer = form.payment_method === 'bank_transfer'
  const bank = options?.payment?.bank || {}
  const hasBankDetails = Boolean(bank.iban || bank.rib || bank.bank || bank.holder)
  const canSubmit = cities.length > 0 && methods.length > 0 && Boolean(form.payment_method)

  // Bank transfer leaves the store without a receipt, so the customer sends the
  // order straight to WhatsApp: the number is the store's, the text is theirs.
  const whatsappNumber = (options?.payment?.whatsapp || '').replace(/\D/g, '')
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        [
          t('checkout', 'whatsappIntro'),
          '',
          ...[
            ['name', form.name],
            ['phone', form.phone],
            ['city', form.city],
            ['address', form.notes ? `${form.address} — ${form.notes}` : form.address],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => `${t('checkout', k)} : ${v}`),
          '',
          `${t('checkout', 'whatsappItems')} :`,
          ...cart.map((l) => `${l.quantity} × ${l.name} — ${formatPrice(l.price * l.quantity, locale)}`),
          '',
          `${t('cart', 'total')} : ${quote ? formatPrice(quote.total, locale) : formatPrice(cartSubtotal, locale)}`,
        ].join('\n'),
      )}`
    : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-serif text-3xl text-noir">{t('checkout', 'title')}</h1>

      {message && (
        <div role="alert" className="mt-6 border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {message}
          {errors.message && <span className="block text-xs">{errors.message[0]}</span>}
        </div>
      )}

      <div className="mt-8 grid gap-10 md:grid-cols-[1fr_300px]">
        <form id="checkout-form" onSubmit={submit} noValidate className="space-y-5">
          {field('name', t('checkout', 'name'), { autoComplete: 'name' })}
          {field('phone', t('checkout', 'phone'), { type: 'tel', autoComplete: 'tel', inputMode: 'tel', placeholder: '0612345678' })}

          <label className="block">
            <span className="font-semibold text-xs uppercase tracking-widest text-stone-400">{t('checkout', 'city')}</span>
            {optionsError ? (
              <p className="mt-1.5 border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                {t('checkout', 'cityError')}
              </p>
            ) : (
              <select
                value={form.city}
                onChange={update('city')}
                required
                aria-label={t('checkout', 'city')}
                className={`mt-1.5 w-full appearance-none border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gold ${
                  errors.city ? 'border-rose-400' : 'border-stone-200'
                }`}
              >
                <option value="" disabled>
                  {cities.length ? t('checkout', 'cityPlaceholder') : t('checkout', 'cityLoading')}
                </option>
                {cities.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
            {errors.city && <span className="mt-1 block text-xs text-rose-600">{errors.city[0]}</span>}
          </label>

          {field('address', t('checkout', 'address'), { autoComplete: 'street-address' })}

          <label className="block">
            <span className="font-semibold text-xs uppercase tracking-widest text-stone-400">{t('checkout', 'notes')}</span>
            <textarea
              value={form.notes}
              onChange={update('notes')}
              rows={3}
              className="mt-1.5 w-full border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gold"
            />
          </label>

          <fieldset>
            <legend className="font-semibold text-xs uppercase tracking-widest text-stone-400">{t('checkout', 'payment')}</legend>
            <div className="mt-2 space-y-2">
              {methods.map((m) => (
                <label
                  key={m.code}
                  className={`flex cursor-pointer items-start gap-3 border bg-white px-4 py-3 text-sm transition ${
                    form.payment_method === m.code ? 'border-gold' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={m.code}
                    checked={form.payment_method === m.code}
                    onChange={update('payment_method')}
                    className="mt-0.5 accent-[#b8506b]"
                  />
                  <span>
                    <span className="block text-noir">{m.label}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.payment_method && (
              <span className="mt-1 block text-xs text-rose-600">{errors.payment_method[0]}</span>
            )}
          </fieldset>

          {isTransfer && hasBankDetails && (
            <dl className="space-y-1 border border-stone-200 bg-white p-4 text-sm">
              <p className="text-xs uppercase tracking-widest text-stone-400">{t('checkout', 'bankDetails')}</p>
              {bank.holder && (
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">{t('checkout', 'bankHolder')}</dt>
                  <dd className="text-end">{bank.holder}</dd>
                </div>
              )}
              {bank.bank && (
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">{t('checkout', 'bankName')}</dt>
                  <dd className="text-end">{bank.bank}</dd>
                </div>
              )}
              {bank.rib && (
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">RIB</dt>
                  <dd className="text-end font-mono">{bank.rib}</dd>
                </div>
              )}
              {bank.iban && (
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">IBAN</dt>
                  <dd className="text-end break-all font-mono">{bank.iban}</dd>
                </div>
              )}
            </dl>
          )}

          {isTransfer && <BankSlipImage image={bank.image} />}

          {isTransfer && whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-jade py-3 text-center text-xs uppercase tracking-widest text-white transition hover:bg-noir"
            >
              {t('checkout', 'whatsappOrder')}
            </a>
          )}
        </form>

        <aside className="h-fit border border-stone-200 bg-white p-6">
          <p className="mb-3 text-xs uppercase tracking-widest text-stone-400">{t('checkout', 'orderSummary')}</p>

          <ul className="space-y-2 border-b border-stone-200 pb-4 text-sm">
            {cart.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span className="text-stone-600">
                  {l.name} <span className="text-stone-400">×{l.quantity}</span>
                </span>
                <span className="shrink-0">{formatPrice(l.price * l.quantity, locale)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">{t('cart', 'subtotal')}</dt>
              <dd>{formatPrice(cartSubtotal, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">{t('cart', 'shipping')}</dt>
              <dd>
                {!form.city
                  ? '—'
                  : quote
                    ? quote.shipping_cost === 0
                      ? t('common', 'free')
                      : formatPrice(quote.shipping_cost, locale)
                    : '…'}
              </dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2 font-medium">
              <dt>{t('cart', 'total')}</dt>
              <dd>{quote ? formatPrice(quote.total, locale) : '…'}</dd>
            </div>
          </dl>

          <button
            type="submit"
            form="checkout-form"
            disabled={placing || !canSubmit}
            className="mt-5 w-full bg-noir py-3 text-xs uppercase tracking-widest text-white transition hover:bg-gold disabled:opacity-50"
          >
            {placing ? t('common', 'loading') : t('checkout', 'place')}
          </button>
        </aside>
      </div>
    </div>
  )
}
