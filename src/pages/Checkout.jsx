import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useApp } from '../context/AppContext'
import { formatPrice } from '../lib/format'
import { EmptyState } from '../components/Spinner'
import BankSlipImage from '../components/BankSlipImage'
import CityPicker from '../components/CityPicker'

const emptyForm = {
  name: '',
  phone: '',
  // Optional. Collected only so the store can email a receipt or reply to its
  // own order alert; the WhatsApp handover is how most orders actually reach
  // the owner, so this must never be required.
  email: '',
  city: '',
  address: '',
  notes: '',
  // Filled from the API: the store decides which methods it accepts.
  payment_method: '',
}

/**
 * The numbered circle beside each step of the bank transfer flow.
 *
 * `done` and `locked` are the two states that carry meaning: a checkmark for
 * something already in hand, a padlock for the step that is not available yet.
 * Without them the list reads as three equal instructions, which is what it is
 * not — step 2 is the only thing to press.
 */
function StepMarker({ done = false, locked = false }) {
  if (done) {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-jade text-white"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
          <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  if (locked) {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-stone-300 text-stone-400"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
          <path d="M10 2a4 4 0 00-4 4v2H5a1 1 0 00-1 1v8a1 1 0 001 1h10a1 1 0 001-1V9a1 1 0 00-1-1h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z" />
        </svg>
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold bg-gold/15 font-mono text-xs text-gold"
    >
      2
    </span>
  )
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

  const field = (key, label, props = {}) => {
    const { hint, ...rest } = props

    return (
      <label className="block">
        <span className="font-semibold text-xs uppercase tracking-widest text-stone-400">{label}</span>
        <input
          value={form[key]}
          onChange={update(key)}
          {...rest}
          dir={key === 'email' ? 'ltr' : undefined}
          className={`mt-1.5 w-full border bg-ivory px-3 py-2.5 text-sm outline-none transition focus:border-gold ${
            errors[key] ? 'border-rose-400' : 'border-stone-200'
          }`}
        />
        {hint && <span className="mt-1 block text-xs text-stone-400">{hint}</span>}
        {errors[key] && <span className="mt-1 block text-xs text-rose-600">{errors[key][0]}</span>}
      </label>
    )
  }

  const cities = options?.cities || []
  // The chosen city's carrier fee and delay, for the summary. The authoritative
  // total is still `quote.shipping_cost`, computed server-side; this is only for
  // the delay, which the quote does not carry.
  const selectedCity = cities.find((c) => c.value === form.city) || null
  const methods = options?.payment_methods || []
  const isTransfer = form.payment_method === 'bank_transfer'
  const bank = options?.payment?.bank || {}
  const hasBankDetails = Boolean(bank.iban || bank.rib || bank.bank || bank.holder)
  const canSubmit = cities.length > 0 && methods.length > 0 && Boolean(form.payment_method)

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
          {field('email', t('checkout', 'email'), {
            type: 'email',
            autoComplete: 'email',
            placeholder: 'you@example.com',
            hint: t('checkout', 'emailHint'),
          })}

          {optionsError ? (
            <div>
              <span className="font-semibold text-xs uppercase tracking-widest text-stone-400">{t('checkout', 'city')}</span>
              <p className="mt-1.5 border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                {t('checkout', 'cityError')}
              </p>
            </div>
          ) : (
            // A combobox rather than a <select>: there are 444 deliverable
            // cities, which no native dropdown can usefully present. The chosen
            // city's fee is shown under the field as soon as it is picked.
            <CityPicker
              cities={cities}
              value={form.city}
              onChange={(city) => {
                update('city')({ target: { value: city } })
              }}
              locale={locale}
              t={t}
              invalid={Boolean(errors.city)}
            />
          )}
          {errors.city && <span className="mt-1 block text-xs text-rose-600">{errors.city[0]}</span>}

          {field('address', t('checkout', 'address'), { autoComplete: 'street-address' })}

          <label className="block">
            <span className="font-semibold text-xs uppercase tracking-widest text-stone-400">{t('checkout', 'notes')}</span>
            <textarea
              value={form.notes}
              onChange={update('notes')}
              rows={3}
              className="mt-1.5 w-full border border-stone-200 bg-ivory px-3 py-2.5 text-sm outline-none transition focus:border-gold"
            />
          </label>

          <fieldset>
            <legend className="font-semibold text-xs uppercase tracking-widest text-stone-400">{t('checkout', 'payment')}</legend>
            <div className="mt-2 space-y-2">
              {methods.map((m) => (
                <label
                  key={m.code}
                  className={`flex cursor-pointer items-start gap-3 border bg-ivory px-4 py-3 text-sm transition ${
                    form.payment_method === m.code ? 'border-gold' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={m.code}
                    checked={form.payment_method === m.code}
                    onChange={update('payment_method')}
                    className="mt-0.5 accent-gold"
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
            // Three steps rather than a form with a WhatsApp escape hatch on
            // it. Handing out the WhatsApp link before the order exists meant
            // the shop had a conversation about an order it could not see: no
            // reference, no stock committed, nothing to reconcile against.
            // The order comes first, the receipt link second.
            <section className="overflow-hidden border border-gold/40 bg-ivory">
              <header className="flex items-center gap-3 border-b border-gold/30 bg-gold/10 px-4 py-3">
                <span className="font-serif text-base text-noir">{t('checkout', 'transferTitle')}</span>
                <span className="ms-auto text-[11px] uppercase tracking-widest text-stone-500">
                  {t('checkout', 'transferBadge')}
                </span>
              </header>

              <ol className="divide-y divide-stone-200">
                {/* 1 — the details. Already in hand, nothing to do. */}
                <li className="flex gap-4 p-4">
                  <StepMarker done />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-noir">{t('checkout', 'stepDetails')}</p>
                    <dl className="mt-2 space-y-1 text-sm">
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

                    <BankSlipImage image={bank.image} />
                  </div>
                </li>

                {/* 2 — place the order. The CTA lives here, not in the summary,
                    so the button that commits sits next to the bank details
                    that made it necessary. */}
                <li className="flex gap-4 bg-white/60 p-4">
                  <StepMarker />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-noir">{t('checkout', 'stepConfirm')}</p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">{t('checkout', 'stepConfirmHint')}</p>

                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={placing || !canSubmit}
                      className="mt-3 flex w-full items-center justify-center gap-2 bg-noir px-4 py-3.5 text-xs uppercase tracking-widest text-white transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {placing ? t('common', 'loading') : t('checkout', 'placeOrderCta')}
                    </button>
                  </div>
                </li>

                {/* 3 — locked until the order exists. */}
                <li className="flex gap-4 p-4">
                  <StepMarker locked />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-400">{t('checkout', 'stepWhatsapp')}</p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-400">{t('checkout', 'stepWhatsappHint')}</p>
                  </div>
                </li>
              </ol>
            </section>
          )}
        </form>

        <aside className="h-fit border border-stone-200 bg-ivory p-6">
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
                {/* The carrier's delay for the chosen city, which the summary
                    otherwise never showed even though the API has it. */}
                {form.city && selectedCity?.delay && (
                  <span className="block text-xs text-stone-400">{selectedCity.delay}</span>
                )}
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
