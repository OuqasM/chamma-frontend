import { useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, imageUrl } from '../lib/api'
import { useApp } from '../context/AppContext'
import { formatPrice } from '../lib/format'
import { knownFee, isFreeDelivery } from '../lib/shipping'
import BankSlipImage from './BankSlipImage'
import CityPicker from './CityPicker'

/**
 * The checkout form, shared by the full page and the drawer.
 *
 * There are two ways into it — `/{locale}/checkout` and the drawer that slides
 * in when something is added to the cart — and they have to collect the same
 * fields, in the same order, with the same server-side quote and the same bank
 * transfer flow. Two copies would not stay that way: the next edit to a field
 * label would land in one of them and the drawer would go on asking for the
 * city the page stopped asking for.
 *
 * So the state and the fields live here and each host arranges them.
 * `useCheckoutForm` owns everything with a side effect; `CheckoutFields` and
 * `OrderSummary` are the two blocks, and only the arrangement differs between a
 * two-column page and a narrow sidebar.
 */

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
 * Form state, the two API reads it depends on, and the submit.
 *
 * `scrollRef` is where an error message is brought into view. On the page that
 * is the window; in the drawer the panel scrolls and the window does not move
 * at all, so a failure the shopper cannot see is a failure they will retry
 * forever.
 *
 * @param {{ onPlaced?: (order: object) => void, scrollRef?: { current: HTMLElement | null } }} options
 */
export function useCheckoutForm({ onPlaced, scrollRef } = {}) {
  const { locale, t, cart, cartSubtotal, clearCart } = useApp()
  const navigate = useNavigate()

  // The place-order button in the bank transfer panel lives outside the <form>
  // and targets it by id. The page and the drawer can be mounted at the same
  // time — the drawer sits in the layout, the page is a route — so a fixed id
  // would be duplicated in the document and the drawer would submit the page's
  // form, silently checking out whatever the shopper was not looking at.
  const formId = useId()

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

  // Clearing a field's error as soon as it is edited, so the message does not
  // sit under a value that has already been corrected.
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
      onPlaced?.(res.order)
      navigate(`/${locale}/order/${res.order.reference}?phone=${encodeURIComponent(form.phone)}&new=1`, {
        replace: true,
        state: { message: res.message, order: res.order },
      })
    } catch (err) {
      setErrors(err.errors || {})
      setMessage(err.message)
      // Put the failure in front of the shopper rather than at the top of a
      // scroll they may not be at the top of.
      if (scrollRef?.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } finally {
      setPlacing(false)
    }
  }

  const cities = options?.cities || []
  const methods = options?.payment_methods || []
  const isTransfer = form.payment_method === 'bank_transfer'
  const bank = options?.payment?.bank || {}
  const hasBankDetails = Boolean(bank.iban || bank.rib || bank.bank || bank.holder)

  // Nothing can be placed until the store has told us where it ships and how it
  // takes payment: a submit button that works before those arrive would post an
  // order the server is going to refuse.
  const canSubmit = cities.length > 0 && methods.length > 0 && Boolean(form.payment_method)

  return {
    t,
    locale,
    cart,
    cartSubtotal,
    form,
    update,
    formId,
    submit,
    optionsError,
    quote,
    errors,
    message,
    placing,
    cities,
    methods,
    isTransfer,
    bank,
    hasBankDetails,
    canSubmit,
  }
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

/**
 * Everything the shopper fills in. Rendered inside the host's <form>.
 */
export function CheckoutFields({ c }) {
  const { form, update, errors, optionsError, cities, methods, isTransfer, bank, hasBankDetails, formId } = c

  const field = (key, label, props = {}) => {
    const { hint, ...rest } = props

    return (
      <label className="block">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-stone-600">{label}</span>
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

  return (
    <div className="space-y-5">
      {field('name', c.t('checkout', 'name'), { autoComplete: 'name' })}
      {field('phone', c.t('checkout', 'phone'), { type: 'tel', autoComplete: 'tel', inputMode: 'tel', placeholder: '0612345678' })}
      {field('email', c.t('checkout', 'email'), {
        type: 'email',
        autoComplete: 'email',
        placeholder: 'you@example.com',
        hint: c.t('checkout', 'emailHint'),
      })}

      {optionsError ? (
        <div>
          <span className="text-[13px] font-semibold uppercase tracking-wider text-stone-600">{c.t('checkout', 'city')}</span>
          <p className="mt-1.5 border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {c.t('checkout', 'cityError')}
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
          locale={c.locale}
          t={c.t}
          invalid={Boolean(errors.city)}
        />
      )}
      {errors.city && <span className="mt-1 block text-xs text-rose-600">{errors.city[0]}</span>}

      {field('address', c.t('checkout', 'address'), { autoComplete: 'street-address' })}

      <label className="block">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-stone-600">{c.t('checkout', 'notes')}</span>
        <textarea
          value={form.notes}
          onChange={update('notes')}
          rows={3}
          className="mt-1.5 w-full border border-stone-200 bg-ivory px-3 py-2.5 text-sm outline-none transition focus:border-gold"
        />
      </label>

      <fieldset>
        <legend className="text-[13px] font-semibold uppercase tracking-wider text-stone-600">{c.t('checkout', 'payment')}</legend>
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
            <span className="font-serif text-base text-noir">{c.t('checkout', 'transferTitle')}</span>
            <span className="ms-auto text-[11px] uppercase tracking-widest text-stone-500">
              {c.t('checkout', 'transferBadge')}
            </span>
          </header>

          <ol className="divide-y divide-stone-200">
            {/* 1 — the details. Already in hand, nothing to do. */}
            <li className="flex gap-4 p-4">
              <StepMarker done />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-noir">{c.t('checkout', 'stepDetails')}</p>
                <dl className="mt-2 space-y-1 text-sm">
                  {bank.holder && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-500">{c.t('checkout', 'bankHolder')}</dt>
                      <dd className="text-end">{bank.holder}</dd>
                    </div>
                  )}
                  {bank.bank && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-500">{c.t('checkout', 'bankName')}</dt>
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
                <p className="text-sm font-semibold text-noir">{c.t('checkout', 'stepConfirm')}</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">{c.t('checkout', 'stepConfirmHint')}</p>

                <button
                  type="submit"
                  form={formId}
                  disabled={c.placing || !c.canSubmit}
                  className="mt-3 flex w-full items-center justify-center gap-2 bg-noir px-4 py-3.5 text-xs uppercase tracking-widest text-white transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {c.placing ? c.t('common', 'loading') : c.t('checkout', 'placeOrderCta')}
                </button>
              </div>
            </li>

            {/* 3 — locked until the order exists. */}
            <li className="flex gap-4 p-4">
              <StepMarker locked />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-stone-400">{c.t('checkout', 'stepWhatsapp')}</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-400">{c.t('checkout', 'stepWhatsappHint')}</p>
              </div>
            </li>
          </ol>
        </section>
      )}
    </div>
  )
}

/**
 * The lines in the order, editable.
 *
 * This used to be two different things in two different places: a read-only
 * name × quantity list in the checkout summary, and a separate `/cart` page
 * carrying the quantity steppers and the remove button. Merging the cart page
 * into checkout left one question — where does a shopper change a quantity? —
 * and the answer cannot be "on the page we just deleted". So the editing lives
 * with the summary, which both the checkout page and the drawer render, and
 * there is exactly one copy of it.
 */
export function CartLines() {
  const { locale, t, cart, setQuantity, removeFromCart } = useApp()

  if (cart.length === 0) return null

  return (
    <ul className="divide-y divide-stone-200 border-b border-stone-200 text-sm">
      {cart.map((line) => (
        <li key={line.id} className="flex gap-3 py-3 first:pt-0 last:pb-4">
          <Link
            to={`/${locale}/products/${line.slug}`}
            className="w-14 shrink-0 overflow-hidden bg-ivory"
            tabIndex={-1}
            aria-hidden="true"
          >
            {imageUrl(line.image) && (
              <img src={imageUrl(line.image)} alt="" className="aspect-[4/5] w-full object-cover" />
            )}
          </Link>

          <div className="flex min-w-0 flex-1 flex-col">
            <Link to={`/${locale}/products/${line.slug}`} className="font-serif hover:text-gold">
              {line.name}
            </Link>
            <p className="mt-0.5 text-xs text-stone-500">{formatPrice(line.price, locale)}</p>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center border border-stone-200 text-xs">
                <button
                  type="button"
                  onClick={() => setQuantity(line.id, line.quantity - 1)}
                  className="px-2.5 py-1 hover:text-gold"
                  aria-label="-"
                >
                  −
                </button>
                <span className="min-w-8 text-center">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(line.id, line.quantity + 1)}
                  // Stock, not the 20-per-line cap the cart state applies: the
                  // cap is there to stop a fat-fingered quantity, this is
                  // telling the shopper there is nothing left to add.
                  disabled={line.stock != null && line.quantity >= line.stock}
                  className="px-2.5 py-1 hover:text-gold disabled:opacity-30"
                  aria-label="+"
                >
                  +
                </button>
              </div>

              <span className="shrink-0 font-medium">{formatPrice(line.price * line.quantity, locale)}</span>
            </div>

            <button
              type="button"
              onClick={() => removeFromCart(line.id)}
              className="mt-1 self-start text-xs text-stone-400 underline hover:text-rose-700"
            >
              {t('cart', 'remove')}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * What is being bought and what it costs.
 *
 * The button targets the form by id rather than nesting inside it, so it can
 * sit below the form on the page or pinned to the foot of the drawer's scroll
 * area — opposite ends of a scroll, without the form having to wrap around it.
 */
export function OrderSummary({ c, className = '', wide = false }) {
  const { t, locale, cartSubtotal, form, quote } = c

  // The delivery figure, and only ever one the server actually sent. A quote
  // with no `shipping_cost` in it prints an ellipsis rather than "Offerte" — see
  // lib/shipping.js for why a missing number must not be read as a free one.
  const shippingFigure = () => {
    if (!quote) return '…'
    if (isFreeDelivery(quote.shipping_cost)) return t('common', 'free')
    if (!knownFee(quote.shipping_cost)) return '…'
    return formatPrice(quote.shipping_cost, locale)
  }

  return (
    <div className={className}>
      <h2 className="border-b border-stone-300 pb-2 font-serif text-xl text-noir">
        {t('checkout', 'orderSummary')}
      </h2>

      {/* The lines and the arithmetic sit side by side when the summary has a
          page's width to itself, and stacked when it does not.

          Driven by a prop rather than a breakpoint on purpose: the drawer is a
          30rem panel inside a viewport of any size, so `md:` would split a
          480px panel on a laptop and stack the same panel on a phone. The
          panel is what decides this, not the screen. */}
      <div className={`mt-4 ${wide ? 'md:grid md:grid-cols-[minmax(0,1fr)_260px] md:gap-10' : ''}`}>
        <CartLines />

        <dl className={`space-y-1.5 text-sm ${wide ? 'mt-6 md:mt-0' : 'mt-4'}`}>
          <div className="flex justify-between">
            <dt className="text-stone-500">{t('cart', 'subtotal')}</dt>
            <dd>{formatPrice(cartSubtotal, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">{t('cart', 'shipping')}</dt>
            <dd>
              {/* The quote's own shipping figure, whatever city has been
                  chosen — including none.

                  This used to print an em dash until a city was picked, on the
                  reasoning that the fee is unknown until then. But the total on
                  the row below already included the server's answer (the flat
                  cost, with no city to look up), so the summary showed
                  "Livraison —" directly above a total that had 35 MAD of
                  delivery in it. The two disagreed, and a dash in a money column
                  does not read as "not calculated yet" — it reads as nothing to
                  pay. Showing the estimate the total is actually using makes
                  the column add up. It can still move once a city is chosen,
                  which is the whole point of choosing one here rather than at
                  the end. */}
              {shippingFigure()}
            </dd>
          </div>
          {/* The one number the shopper came for, given the weight of it: a rule
              above in ink rather than stone, and set in the serif at a size
              nothing else on the page uses. */}
          <div className="mt-3 flex items-baseline justify-between gap-4 border-t-2 border-noir pt-3">
            <dt className="font-serif text-base text-noir">{t('cart', 'total')}</dt>
            <dd className="font-serif text-2xl leading-none text-noir">
              {quote ? formatPrice(quote.total, locale) : '…'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

/**
 * The commit button.
 *
 * A `submit` button targeting the form by id, never nested inside it, so it can
 * sit in a sidebar column on the page or pinned to the foot of the drawer's
 * scroll area without the form having to wrap around it.
 */
export function PlaceOrderButton({ c, className = '' }) {
  const { t, locale, placing, canSubmit, formId, quote, form, isTransfer, hasBankDetails } = c

  // The bank-transfer flow puts its own submit in step 2, next to the bank
  // details that made a transfer necessary — deliberately, so the button that
  // commits sits beside the thing being committed to. That means this one has
  // to stand down for it, or the shopper is offered two identical buttons to
  // choose between. Decided here rather than in each host: the page and the
  // drawer both mount `CheckoutFields`, and deciding per host is how the two
  // copies of this button came to disagree in the first place.
  //
  // The total stays either way. It is the one thing pinned in the drawer, so
  // removing it with the button would take the running total off screen for
  // exactly the shoppers who have scrolled furthest into the form.
  const inlineCta = isTransfer && hasBankDetails

  // Reassurance from the shop's own translated words rather than new copy: the
  // two facts that actually stop someone abandoning at the last field.
  //
  // Both are conditional on being true. Free delivery is claimed only when the
  // quote says the shipping is free, cash on delivery only when that is the
  // method chosen — reassuring a shopper with something the server is about to
  // contradict is worse than saying nothing at all.
  const notes = []
  // Gated on a city being chosen, not just on the quote: delivery cost is a
  // function of where it is going, so before a city is picked the quote is not
  // an answer yet. Claiming free delivery there is a promise the next quote
  // gets to break, and a shopper shown "free" and then charged has been told
  // two different things about the same order.
  if (form.city && quote && quote.shipping_cost === 0) notes.push(t('checkout', 'freeDelivery'))
  if (form.payment_method === 'cod') notes.push(t('checkout', 'cod'))

  return (
    <div className={className}>
      {/* The total restated directly above the button that spends it. On both
          hosts the summary sits at the top of the scroll area and this is
          pinned at the foot, so this is the last thing read before the click
          and the only one still on screen after the summary scrolls away. */}
      <div className="mb-3 flex items-baseline justify-between gap-4 border-t border-stone-300 pt-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-stone-500">
          {t('cart', 'total')}
        </span>
        <span className="font-serif text-2xl leading-none text-noir">
          {quote ? formatPrice(quote.total, locale) : '…'}
        </span>
      </div>

      {!inlineCta && (
        <button
          type="submit"
          form={formId}
          disabled={placing || !canSubmit}
          className="w-full bg-noir py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {placing ? t('common', 'loading') : t('checkout', 'place')}
        </button>
      )}

      {notes.length > 0 && <p className="mt-3 text-center text-xs text-stone-500">{notes.join(' · ')}</p>}
    </div>
  )
}

/**
 * The failure banner. Kept here so both hosts put it in the same place — at
 * the top of the scrollable area, above the fields it is about.
 */
export function CheckoutError({ message, errors }) {
  if (!message) return null

  return (
    <div role="alert" className="mb-5 border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {message}
      {errors?.message && <span className="block text-xs">{errors.message[0]}</span>}
    </div>
  )
}
