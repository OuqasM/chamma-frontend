import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, api } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState } from '../../components/Spinner'
import { SOCIAL_ICONS } from '../../components/SocialIcons'
import { Select, TextInput } from '../../components/admin/Form'
import ProductActions from '../../components/admin/ProductActions'
import { nationalDigits, normalisePhone } from '../../lib/phone'
import { knownFee } from '../../lib/shipping'
import {
  Badge,
  Banner,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  PrimaryButton,
  StatCard,
  Table,
  Td,
  buttonClass,
} from '../../components/admin/Ui'

const blank = () => ({ q: '', status: '', start_date: '', end_date: '', page: 1 })

const emptyDraft = () => ({
  name: '',
  phone: '',
  city: '',
  address: '',
  notes: '',
  payment_method: '',
  // Paid, because the order this form records has already happened: the
  // customer called, the parcel went out, the money changed hands. The owner
  // unticks it for a transfer that has not arrived yet.
  payment_status: 'paid',
  // What this order costs to deliver. Empty means "the carrier's price for
  // the city", and the city fills it in.
  shipping_cost: '',
  // Whether the owner has decided what this order costs.
  shipping_manual: false,
  // Whether that figure is kept for the city. A price the owner sets is the
  // price of delivering to that city; a free delivery for one order is not a
  // decision about every order that follows.
  remember_fee: false,
  // A delivery the owner is not charging for.
  free_shipping: false,
  // The owner's own figure for what the order earned. Empty means the sums
  // work it out — the total minus the goods minus the parcel — and it keeps
  // following the purchase prices when they are rectified.
  benefit: '',
  items: [],
})

/**
 * The owner typing in an order they just took on the phone, or at the counter.
 *
 * It is deliberately the same fields as the storefront checkout, in the same
 * order, and it posts to the same place. The alternative — a separate "manual
 * order" table — would mean the owner had to remember which of two tables a
 * customer landed in, and every later question ("where is this order?") would
 * need both.
 *
 * Prices are not in this form on purpose. They are re-read from the database by
 * OrderService, so a stale price in the panel can never be charged, and stock is
 * checked the same way. The owner picks products and quantities; the server
 * decides what they cost.
 */
function NewOrderModal({ locale, t, open, onClose, call }) {
  const [draft, setDraft] = useState(emptyDraft)
  const [options, setOptions] = useState(null)
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState([])
  const [looking, setLooking] = useState(false)
  const [quote, setQuote] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // The customers the typed number belongs to, and the one the owner picked
  // out of them.
  const [customers, setCustomers] = useState([])
  const [lookingCustomer, setLookingCustomer] = useState(false)
  const [searched, setSearched] = useState(null)
  const [picked, setPicked] = useState(null)

  // Whether the owner is in the phone field. The list shows itself only then:
  // a dropdown covering the form before anybody has touched anything is in
  // the way, not a help.
  //
  // The rows themselves are loaded as soon as the form opens, so clicking
  // into the field brings them up straight away rather than after a wait.
  const [phoneFocused, setPhoneFocused] = useState(false)

  // The phone field and the list under it. Clicking anywhere else closes the
  // list: a dropdown left hanging over the name field would cover the field
  // the owner is trying to fill in.
  const phoneRef = useRef(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e) => {
      if (!phoneRef.current?.contains(e.target)) {
        setPhoneFocused(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Accepts a patch object or an updater function, like React's own setState.
  // The options effect needs the updater form: it has to default the payment
  // method from the server's config only if the owner has not chosen one, and
  // reading `draft` directly there would read a value from the render that
  // started the request rather than the current one.
  const set = useCallback(
    (patch) =>
      setDraft((d) => (typeof patch === 'function' ? patch(d) : { ...d, ...patch })),
    [],
  )

  // Cities and payment methods come from the same services checkout reads, so
  // the panel cannot offer a city that checkout would then reject.
  useEffect(() => {
    if (!open) return
    let alive = true
    api
      .checkoutOptions(locale)
      .then((d) => {
        if (!alive) return
        setOptions(d)
        // The default payment method comes from the server, because "cod" is a
        // config value that can change and a hardcoded default would quietly
        // disagree with what checkout offers. City has no default by design:
        // guessing where a parcel goes is not a panel's decision to make.
        set((current) => ({
          ...current,
          payment_method: current.payment_method || d?.payment?.default || '',
        }))
      })
      .catch(() => {
        if (alive) setError(t('checkout', 'cityError'))
      })
    return () => {
      alive = false
    }
  }, [open, locale, t, set])

  // Debounced product search. `useEffect` + a timer rather than a submit button
  // because the owner is usually scanning a shelf with one hand.
  useEffect(() => {
    if (!open) return
    const term = search.trim()
    if (term.length < 2) {
      setMatches([])
      return
    }
    let alive = true
    setLooking(true)
    const timer = setTimeout(() => {
      adminApi
        .products(locale, { search: term, per_page: 8 })
        .then((d) => {
          if (alive) setMatches(d?.data || [])
        })
        .catch(() => {
          if (alive) setMatches([])
        })
        .finally(() => {
          if (alive) setLooking(false)
        })
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
      setLooking(false)
    }
  }, [search, open, locale])

  // The customer lookup, which is what the phone field is for.
  //
  // The dropdown opens with rows in it — the customers the shop saw most
  // recently — because the owner is usually recording an order for somebody
  // they have dealt with before, and a list that says "type to search" says
  // nothing. What they type then filters those rows: a number typed as it is
  // spoken (a prefix) or a name.
  //
  // The number is reduced before it is compared on the server, the one place
  // that decides what a number is: "0612345678", "06 12 34 56 78" and
  // "+212 6 12 34 56 78" are one handset, and the customer behind it is one
  // customer.
  useEffect(() => {
    if (!open) return

    const term = draft.phone.trim()

    // A number the owner picked out of the list is not a search any more.
    if (picked && term && normalisePhone(term) === normalisePhone(picked.phone)) {
      setCustomers([])
      setSearched(term)
      return
    }

    let alive = true
    setLookingCustomer(true)

    // The first load is not debounced — the rows are wanted now — and the
    // rest are, because the owner is typing.
    const timer = setTimeout(
      () => {
        call((signal) => adminApi.searchCustomers(locale, { q: term }, { signal }))
          .then((d) => {
            if (!alive) return
            setCustomers(d?.customers || [])
            setSearched(term)
          })
          .catch(() => {
            if (!alive) return
            setCustomers([])
            setSearched(term)
          })
          .finally(() => {
            if (alive) setLookingCustomer(false)
          })
      },
      term === '' ? 0 : 250,
    )

    return () => {
      alive = false
      clearTimeout(timer)
      setLookingCustomer(false)
    }
  }, [open, locale, draft.phone, picked, call])

  // Shipping is priced by the same server endpoint checkout uses, so a phone
  // order is charged the city's carrier fee and the free-delivery threshold
  // exactly like an online one. The client never decides the fee.
  useEffect(() => {
    if (!open) return
    if (draft.items.length === 0) {
      setQuote(null)
      return
    }
    let alive = true
    api
      .quote(locale, {
        city: draft.city,
        items: draft.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      })
      .then((d) => {
        if (alive) setQuote(d)
      })
      .catch(() => {
        if (alive) setQuote(null)
      })
    return () => {
      alive = false
    }
  }, [open, locale, draft.city, draft.items])

  // The number the owner is typing.
  //
  // Changing it drops the customer that was picked out of the list: those
  // details belong to that customer's number, and a different number is a
  // different person. The name and the address are left alone — the owner may
  // have corrected them, and emptying a field somebody just filled in is
  // worse than a stale one they can see.
  const setPhone = (value) => {
    set({ phone: value })

    if (picked && nationalDigits(value) !== nationalDigits(picked.phone)) {
      setPicked(null)
    }
  }

  // The number is reduced to the one form the shop agrees on when the field is
  // left, not on every keystroke: rewriting the field under the caret while
  // somebody is still typing it is how a number ends up mangled.
  const normaliseTypedPhone = () => {
    const normalised = normalisePhone(draft.phone)

    if (normalised && normalised !== draft.phone) {
      set({ phone: normalised })
    }
  }

  // Leaving the field closes the list. The dropdown items take the pointer
  // down with `preventDefault`, so choosing one never blurs the field and the
  // list is still there when the click lands.
  const leavePhoneField = () => {
    normaliseTypedPhone()
    setPhoneFocused(false)
  }

  /**
   * A customer the shop already knows.
   *
   * Their name, their city and their address come with them: a regular
   * should not be asked where they live again, and the delivery fee follows
   * the city that came with them.
   */
  const chooseCustomer = (customer) => {
    // The city is only prefilled when the shop still delivers there. A city
    // that has left the carrier's table would sit in the field as a value the
    // <select> cannot show, and the save would be refused for a field the
    // owner cannot see.
    const deliverable = (options?.cities || []).some((c) => c.value === customer.city)

    setPicked(customer)
    set({
      phone: customer.phone || draft.phone,
      name: customer.name || '',
      address: customer.address || '',
      city: deliverable ? customer.city : '',
    })
    setCustomers([])
  }

  // The stock decisions the owner made while writing the order. They are
  // **queued**, not made: they travel with the order and are applied when it
  // is saved, so an order the owner abandons leaves the shop's stock alone.
  const [stockActions, setStockActions] = useState([])

  /**
   * Queue a stock decision — or take it back, because the owner changed their
   * mind before saving.
   */
  const queueStockAction = (action) => {
    setStockActions((list) => {
      const same = list.findIndex(
        (a) =>
          a.type === action.type &&
          a.product_id === action.product_id &&
          (a.variant ?? null) === (action.variant ?? null),
      )

      return same >= 0 ? list.filter((_, i) => i !== same) : [...list, action]
    })
  }

  const addItem = (product) => {
    setDraft((d) => {
      // A product sold in variants cannot be merged into an existing row: the
      // two lines would then have to share one variant choice, and the whole
      // point of a phone order is "two of the 50 ml and one of the 100 ml".
      const hasVariants = Boolean(product.has_variants) && (product.variants?.length ?? 0) > 0
      // Non-variant products keep the merge rule: adding the same product
      // twice raises its quantity rather than creating two rows that then have
      // to be reconciled to get the right order.
      const existing = hasVariants ? null : d.items.find((i) => i.product_id === product.id)
      if (existing) {
        return {
          ...d,
          items: d.items.map((i) =>
            i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        }
      }
      return {
        ...d,
        items: [
          ...d.items,
          {
            // Lines are addressed by product + which addition of that product
            // this is, so two lines of one variant product stay two lines —
            // and stay distinct even after one of them was removed.
            seq:
              d.items.reduce(
                (n, i) => (i.product_id === product.id ? Math.max(n, i.seq ?? 0) : n),
                -1,
              ) + 1,
            product_id: product.id,
            name: product.name,
            price: product.price,
            // What the shop paid for it: the benefit the order will earn is
            // worked out from this, and the owner should see it while writing.
            cost_price: product.cost_price,
            stock: product.stock,
            has_variants: hasVariants,
            variants: hasVariants
              ? product.variants.map((v) => ({ id: v.id, name: v.name }))
              : null,
            // Nothing is pre-selected: the server rejects a variant line that
            // does not name a variant, and the shop would ship a guessing
            // mistake otherwise.
            variant: null,
            quantity: 1,
          },
        ],
      }
    })
    setSearch('')
    setMatches([])
  }

  // Which line of the draft this is: product + which of its additions.
  const lineId = (item) => `${item.product_id}::${item.seq ?? 0}`

  const setQuantity = (key, quantity) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        lineId(i) === key ? { ...i, quantity: Math.max(1, Number(quantity) || 1) } : i,
      ),
    }))

  // Replacing a line's variant, not removing it: the owner changes their mind
  // about the size, the quantity stays.
  const setLineVariant = (key, variant) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => (lineId(i) === key ? { ...i, variant: variant || null } : i)),
    }))

  const removeItem = (key) =>
    setDraft((d) => ({ ...d, items: d.items.filter((i) => lineId(i) !== key) }))

  const close = () => {
    // Throw away the draft rather than leaving it behind the next time the
    // owner opens this for a different customer.
    setDraft(emptyDraft())
    setSearch('')
    setMatches([])
    setCustomers([])
    setSearched(null)
    setPicked(null)
    setStockActions([])
    setPhoneFocused(false)
    setError(null)
    onClose()
  }

  // A product with variants has not been ordered until a variant names which
  // one: the server would refuse it, and the shelf needs the size.
  const missingVariant = draft.items.some((i) => i.has_variants && !i.variant)

  const save = async (e) => {
    e.preventDefault()
    if (saving || draft.items.length === 0 || missingVariant) return
    setSaving(true)
    setError(null)

    try {
      const body = {
        name: draft.name,
        // The number goes out in the one form the shop agrees on, so the
        // order, the customer record and the panel's own search all point at
        // the same handset. The server normalises it again — it is the one
        // place that decides what a number is.
        phone: normalisePhone(draft.phone) || draft.phone,
        city: draft.city,
        address: draft.address,
        notes: draft.notes || null,
        payment_method: draft.payment_method,
        payment_status: draft.payment_status,
        // What the owner decided the delivery costs. Null when they did not
        // decide: the server then works out the carrier's price for the city
        // — and the free-delivery threshold — which is the same figure the
        // quote on the screen is showing.
        shipping_cost: draft.shipping_manual && draft.shipping_cost !== ''
          ? Number(draft.shipping_cost)
          : null,
        // And whether that figure is kept for the city. A price the owner
        // sets is the price of delivering to that city; a free delivery for
        // one order is not a decision about every order that follows.
        remember_fee: draft.remember_fee,
        // The stock decisions, made while writing the order and applied when
        // it is saved.
        stock_actions: stockActions,
        // The owner's own figure for what the order earned, when they gave
        // one: the sums do not know the rate the supplier actually gave, and
        // the owner does. Empty, the order carries the calculation.
        benefit: draft.benefit === '' ? null : Number(draft.benefit),
        // Only the fields the server needs. `name`/`price`/`stock` above
        // are for display; sending them would invite the server to trust a
        // label the owner typed.
        items: draft.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          variant: i.variant || null,
        })),
      }
      const res = await call((signal) => adminApi.createOrder(locale, body, { signal }))
      close()
      onClose({ order: res?.order })
    } catch (err) {
      // The backend answers 422 with the reason — sold out, city not served, a
      // name that is blank. That message is more useful than anything to say
      // here, so it is shown as-is.
      setError(err?.message || t('admin', 'newOrderFailed'))
    } finally {
      setSaving(false)
    }
  }

  const money = (value) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-MA' : 'fr-MA', {
      style: 'currency',
      currency: 'MAD',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0)

  // Indicative only. The server recomputes this from the database, and a
  // mismatch here is exactly the sort of thing that must not become the charge.
  const estimate = useMemo(
    () => draft.items.reduce((sum, i) => sum + (Number(i.price) || 0) * i.quantity, 0),
    [draft.items],
  )

  // What the goods in the draft cost the shop. The server reads the same
  // purchase prices when it writes the order, and what the order earned —
  // its benefit — is the total minus this.
  const goodsCost = useMemo(
    () => draft.items.reduce((sum, i) => sum + (Number(i.cost_price) || 0) * i.quantity, 0),
    [draft.items],
  )

  // The carrier's fee for the chosen city.
  //
  // It is known as soon as the city is — what a parcel costs to deliver does
  // not depend on what is inside it — so the owner sees the delivery cost
  // before the products are picked, and a customer found by their number
  // brings the city, and the fee, with them.
  const cityFee = useMemo(() => {
    const city = (options?.cities || []).find((c) => c.value === draft.city)
    return city ? city.fee : null
  }, [options, draft.city])

  // Whether the shop has priced this city for itself, rather than taking the
  // carrier's price. It is the difference between "this city costs what the
  // courier charges" and "this city costs what you decided".
  const cityOverridden = useMemo(() => {
    const city = (options?.cities || []).find((c) => c.value === draft.city)
    return Boolean(city?.overridden)
  }, [options, draft.city])

  /**
   * Put the city back on the carrier's price.
   */
  const resetCityFee = async () => {
    if (!draft.city) return

    try {
      await call((signal) => adminApi.resetShippingFee(locale, draft.city, { signal }))

      // The city list carries the price, so it is read again rather than
      // patched: the carrier's price and the shop's own are the same field.
      const fresh = await api.checkoutOptions(locale)
      setOptions(fresh)
      set((d) => ({ ...d, shipping_cost: '', shipping_manual: false }))
    } catch {
      // The panel's error banner already says something went wrong; the fee
      // is unchanged, which is the safe direction.
    }
  }

  // The fee follows the city: what a parcel costs to deliver is a fact about
  // where it is going. It is the owner's to change — a negotiated rate, a
  // free delivery — and changing the city puts the new city's price back,
  // because the old figure belonged to the old city.
  useEffect(() => {
    if (!open) return

    set((d) => ({
      ...d,
      shipping_cost: d.free_shipping ? '0' : knownFee(cityFee) ? String(cityFee) : '',
      // The owner's figure belonged to the old city, so it is no longer
      // theirs to send.
      shipping_manual: false,
      remember_fee: false,
    }))
  }, [open, cityFee, set])

  // The fee the order will actually be charged.
  //
  // The owner's figure wins. Otherwise it is the server's: the quote when
  // there are products in it — which is where the free-delivery threshold
  // lives — and the carrier's price for the city before that.
  const manualFee = Number(draft.shipping_cost)
  const hasManualFee = draft.shipping_manual && draft.shipping_cost !== '' && Number.isFinite(manualFee)
  const shippingFee = hasManualFee
    ? manualFee
    : quote
      ? quote.shipping_cost
      : knownFee(cityFee)
        ? cityFee
        : null

  // What the order comes to. The subtotal is the server's, and the fee is
  // whatever the order will really be charged, so the two add up to what
  // will be stored.
  const subtotalFigure = quote ? quote.subtotal : estimate
  const totalFigure = quote && shippingFee !== null ? quote.subtotal + shippingFee : null

  // The parcel is a cost of the sale in its own right: the courier is paid
  // whether the customer is charged for the delivery or it is given free, so
  // the benefit is what is left after the parcel too. The price is the city's
  // own — the figure the owner has priced there, or the carrier's tariff.
  const courierFee = knownFee(cityFee) ? cityFee : null

  // What the order will earn, stated the way the order will state it when it
  // is written: the total minus the goods minus the parcel.
  const expectedBenefit =
    totalFigure !== null && courierFee !== null ? totalFigure - goodsCost - courierFee : null

  // Whether the number is one the shop can work with, and whether the shop
  // has met it before.
  const phoneComplete = normalisePhone(draft.phone) !== null
  const searchedThis = searched !== null && searched === draft.phone.trim()
  const searchedNothing = searchedThis && customers.length === 0 && !lookingCustomer && !picked

  // A number nobody knows is not an error: the order creates the customer.
  const unknownCustomer = phoneComplete && searchedNothing

  // Something was typed and it matched nobody — but it is not a number yet,
  // so there is nothing to say about a customer.
  const noMatch = !phoneComplete && searchedNothing && draft.phone.trim() !== ''

  const tooMany = (item) => Number(item.stock) < item.quantity

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('admin', 'newOrderTitle')}
      wide
      footer={
        <>
          <Ghostish onClick={close} label={t('admin', 'cancel')} />
          <PrimaryButton
            type="submit"
            form="new-order-form"
            disabled={saving || draft.items.length === 0 || missingVariant}
          >
            {saving ? t('admin', 'saving') : t('admin', 'save')}
          </PrimaryButton>
        </>
      }
    >
      <form id="new-order-form" onSubmit={save} className="space-y-6">
        <p className="text-sm text-stone-600">{t('admin', 'newOrderHint')}</p>

        {error && <Banner>{error}</Banner>}

        <fieldset className="space-y-3">
          <legend className="text-[13px] font-semibold text-noir">
            {t('admin', 'newOrderCustomer')}
          </legend>

          {/* The phone comes first because it is the key to everything else:
              it says who this is, and the rest of the form is filled in from
              it. */}
          <div className="relative" ref={phoneRef}>
            <TextInput
              label={t('checkout', 'phone')}
              name="phone"
              type="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={leavePhoneField}
              onFocus={() => setPhoneFocused(true)}
              dir="ltr"
              inputMode="tel"
              placeholder="0612345678"
              hint={t('admin', 'newOrderPhoneHint')}
              required
            />

            {/* The customers: the ones the shop knows, filtered by whatever has
                been typed. The number and the city are what a row shows —
                the number is how the owner recognises the person, and the
                city is what decides the delivery fee. */}
            {phoneFocused && customers.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-ivory shadow-lg">
                {customers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      // The pointer is taken down on the field's blur, so the
                      // list would close before the click landed on it.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => chooseCustomer(c)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left transition hover:bg-stone-50"
                    >
                      <span className="font-mono text-sm text-stone-800" dir="ltr">
                        {c.phone}
                      </span>
                      <span className="truncate text-xs text-stone-500">{c.city || '—'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {phoneFocused && lookingCustomer && customers.length === 0 && (
              <p className="mt-1 text-xs text-stone-400">{t('common', 'loading')}</p>
            )}

            {picked && (
              <p className="mt-1 text-xs text-stone-500">
                {t('admin', 'newOrderKnownCustomer')} — {picked.name}
              </p>
            )}

            {unknownCustomer && (
              <p className="mt-1 text-xs text-stone-500">{t('admin', 'newOrderNewCustomer')}</p>
            )}

            {noMatch && (
              <p className="mt-1 text-xs text-stone-500">{t('admin', 'newOrderNoCustomer')}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label={t('checkout', 'name')}
              name="customer_name"
              autoComplete="name"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              required
            />
            <Select
              label={t('checkout', 'city')}
              name="city"
              value={draft.city}
              onChange={(e) => set({ city: e.target.value })}
              // What the delivery will cost, taken from the carrier's own
              // table for that city. It is a fact, not a guess: the same
              // number the server will charge.
              hint={
                knownFee(cityFee)
                  ? `${t('checkout', 'deliveryFee')}: ${money(cityFee)}`
                  : undefined
              }
              required
            >
              <option value="">{t('checkout', 'cityPlaceholder')}</option>
              {(options?.cities || []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                  {knownFee(c.fee) ? ` · ${money(c.fee)}` : ''}
                </option>
              ))}
            </Select>
          </div>

          <TextInput
            label={t('checkout', 'address')}
            name="address"
            autoComplete="street-address"
            value={draft.address}
            onChange={(e) => set({ address: e.target.value })}
            required
          />

          {/* What this order costs to deliver. The carrier's price for the
              city is what it starts at; the owner is the one who decides
              what this one costs. */}
          <div className="grid items-start gap-3 sm:grid-cols-2">
            <div>
              <TextInput
                label={t('admin', 'newOrderShippingFee')}
                name="shipping_cost"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft.shipping_cost}
                onChange={(e) =>
                  set({
                    shipping_cost: e.target.value,
                    shipping_manual: true,
                    // A price the owner types is the price of delivering to
                    // that city, and it is kept.
                    remember_fee: true,
                  })
                }
                hint={t('admin', 'newOrderShippingFeeHint')}
                readOnly={draft.free_shipping}
              />

              {/* The way back. A city priced for itself — a negotiated rate, a
                  free delivery — can be put back on the carrier's price, and
                  without this a city priced free for one order would stay
                  free for every order after it. */}
              {cityOverridden && (
                <button
                  type="button"
                  onClick={resetCityFee}
                  className="mt-1.5 text-xs font-medium text-plum underline underline-offset-2 hover:text-noir"
                >
                  {t('admin', 'newOrderResetFee')}
                </button>
              )}
            </div>

            <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 px-3.5 py-3 text-sm text-stone-700 transition hover:border-stone-300">
              <input
                type="checkbox"
                checked={draft.free_shipping}
                onChange={(e) => {
                  const free = e.target.checked

                  set({
                    free_shipping: free,
                    // The price of this order, not of the city: a free
                    // delivery for one order is not a decision about every
                    // order that follows.
                    shipping_manual: true,
                    remember_fee: false,
                    shipping_cost: free
                      ? '0'
                      : knownFee(cityFee)
                        ? String(cityFee)
                        : '',
                  })
                }}
                className="mt-0.5 h-4 w-4 accent-gold"
              />
              <span>
                {t('admin', 'newOrderFreeShipping')}
                <span className="block text-xs text-stone-500">
                  {t('admin', 'newOrderFreeShippingHint')}
                </span>
              </span>
            </label>
          </div>

          <TextInput
            label={t('checkout', 'notes')}
            name="notes"
            textarea
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-[13px] font-semibold text-noir">
            {t('admin', 'newOrderItems')}
          </legend>

          <div>
            <TextInput
              label={t('admin', 'newOrderSearchProduct')}
              name="product_search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin', 'searchPlaceholder')}
            />
            {looking && <p className="mt-1 text-xs text-stone-400">{t('common', 'loading')}</p>}
            {!looking && matches.length > 0 && (
              <ul className="mt-1 max-h-56 overflow-auto rounded-xl border border-stone-200 bg-ivory">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addItem(p)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm transition hover:bg-stone-50"
                    >
                      <span className="truncate text-stone-800">{p.name}</span>
                      <span className="whitespace-nowrap text-xs text-stone-500">
                        {money(p.price)} · {t('admin', 'stock')} {p.stock}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!looking && search.trim().length >= 2 && matches.length === 0 && (
              <p className="mt-1 text-xs text-stone-500">{t('admin', 'newOrderNoProduct')}</p>
            )}
          </div>

          {draft.items.length === 0 ? (
            <p className="text-sm text-stone-500">{t('admin', 'newOrderEmptyItems')}</p>
          ) : (
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
              {draft.items.map((item) => {
                const key = lineId(item)
                const missingChoice = item.has_variants && !item.variant

                return (
                  <li key={key} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                    <span className="min-w-40 flex-1 truncate text-sm text-stone-800">{item.name}</span>

                    {item.has_variants && (
                      <select
                        value={item.variant || ''}
                        onChange={(e) => setLineVariant(key, e.target.value)}
                        aria-label={t('product', 'variant') || t('admin', 'variant')}
                        // Before the owner chooses, the field reads as the one
                        // thing wrong with the order — the row is real, the
                        // size is not.
                        className={`rounded-lg border bg-white px-2 py-1.5 text-sm text-noir focus:outline-none focus:ring-2 ${
                          missingChoice
                            ? 'border-rose-300 focus:ring-rose-100'
                            : 'border-stone-200 focus:border-gold focus:ring-gold/15'
                        }`}
                      >
                        <option value="" disabled>
                          {t('product', 'selectVariant')}
                        </option>
                        {item.variants.map((v) => (
                          <option key={v.id || v.name} value={v.name}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {tooMany(item) && (
                      <Badge tone="danger">
                        {t('admin', 'outOfStock')} ({item.stock})
                      </Badge>
                    )}

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => setQuantity(key, e.target.value)}
                      aria-label={t('admin', 'quantity')}
                      className="w-20 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/15"
                    />
                    <span className="w-24 text-right text-sm text-stone-600">
                      {money((Number(item.price) || 0) * item.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(key)}
                      className="text-xs font-medium text-stone-400 transition hover:text-rose-700"
                    >
                      {t('admin', 'newOrderRemoveItem')}
                    </button>

                    {/* The two decisions the owner makes while writing the
                        order: this bottle has just sold out, or this size is
                        discontinued for good. Both belong here — the parcel is
                        going out now, and the shop's stock should say so —
                        and both wait for the save: an order the owner
                        abandons must not leave the stock changed. */}
                    <ProductActions
                      productId={item.product_id}
                      productName={item.name}
                      variant={item.variant}
                      queuedStock={stockActions.some(
                        (a) => a.type === 'out_of_stock' && a.product_id === item.product_id,
                      )}
                      queuedVariant={stockActions.some(
                        (a) =>
                          a.type === 'remove_variant' &&
                          a.product_id === item.product_id &&
                          a.variant === item.variant,
                      )}
                      onQueue={queueStockAction}
                      className="w-full"
                    />
                  </li>
                )
              })}
            </ul>
          )}

          {missingVariant && (
            <p className="text-xs text-rose-600">{t('admin', 'variantRequired')}</p>
          )}

          <dl className="space-y-1.5 rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">{t('cart', 'subtotal')}</dt>
              <dd>{money(quote ? quote.subtotal : estimate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">{t('cart', 'shipping')}</dt>
              <dd>
                {/* What the order will really be charged: the owner's figure
                    when they gave one, the server's quote otherwise — which is
                    where the free-delivery threshold lives — and the carrier's
                    price for the city before that. */}
                {shippingFee === null
                  ? '—'
                  : shippingFee === 0
                    ? t('common', 'free')
                    : money(shippingFee)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2 font-medium text-noir">
              <dt>{t('cart', 'total')}</dt>
              <dd>{totalFigure === null ? '…' : money(totalFigure)}</dd>
            </div>

            {/* The goods cost the shop, and the parcel the courier is paid
                for: both are costs of the sale, and the benefit is what is
                left after them. */}
            <div className="flex justify-between">
              <dt className="text-stone-500">{t('admin', 'ordersCost')}</dt>
              <dd>{money(goodsCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">{t('admin', 'courierCost')}</dt>
              {/* The courier is paid for the parcel whatever the customer is
                  charged: a delivery that was made free is paid out of the
                  margin, so the parcel is stated as its own figure. */}
              <dd>{courierFee === null ? '—' : money(courierFee)}</dd>
            </div>

            {/* The benefit is the owner's to state. The field takes their
                figure when they have one — the rate the supplier actually
                gave, the courier that charged more than the shop billed — and
                when they leave it empty the calculation stands, and keeps
                following the purchase prices when they are rectified. */}
            <div className="flex items-baseline justify-between gap-3 border-t border-stone-200 pt-2">
              <dt className="font-medium text-noir">{t('admin', 'ordersBenefit')}</dt>
              <dd className="text-right">
                <input
                  type="number"
                  name="benefit"
                  step="0.01"
                  inputMode="decimal"
                  value={draft.benefit}
                  onChange={(e) => set({ benefit: e.target.value })}
                  placeholder={expectedBenefit === null ? '…' : String(Math.round(expectedBenefit))}
                  aria-label={t('admin', 'ordersBenefit')}
                  className="w-32 rounded-lg border border-stone-300 px-2 py-1 text-right text-sm font-medium text-stone-800 focus:border-stone-400 focus:outline-none"
                />
                <span className="mt-0.5 block text-[11px] text-stone-400">
                  {t('admin', 'benefitHint')}
                </span>
              </dd>
            </div>
            {/* The calculation behind the figure, so a number the owner
                doubts can be read rather than taken on trust. */}
            {expectedBenefit !== null && (
              <p className="text-[11px] text-stone-400">
                {money(totalFigure)} − {money(goodsCost)} − {money(courierFee)}
              </p>
            )}
          </dl>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-[13px] font-semibold text-noir">
            {t('admin', 'newOrderPaymentMethod')}
          </legend>

          <Select
            label={t('admin', 'method')}
            name="payment_method"
            value={draft.payment_method}
            onChange={(e) => set({ payment_method: e.target.value })}
            required
          >
            {(options?.payment_methods || []).map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </Select>

          {/* The status is not a choice the owner makes here. An order written
              in this panel is one that already happened — the customer called,
              the parcel went out — so it is recorded as delivered rather than
              left in the list waiting for somebody to remember to move it
              along. */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-3 text-sm">
            <span className="font-medium text-noir">
              {t('admin', 'newOrderStatus')} · {t('admin', 'newOrderDelivered')}
            </span>
            <span className="mt-0.5 block text-xs text-stone-500">
              {t('admin', 'newOrderDeliveredHint')}
            </span>
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-stone-200 px-3.5 py-3 text-sm text-stone-700 transition hover:border-stone-300">
            <input
              type="checkbox"
              checked={draft.payment_status === 'paid'}
              onChange={(e) =>
                set({ payment_status: e.target.checked ? 'paid' : 'pending' })
              }
              className="mt-0.5 h-4 w-4 accent-gold"
            />
            <span>
              {t('admin', 'newOrderPaid')}
              <span className="block text-xs text-stone-500">{t('admin', 'newOrderPaidHint')}</span>
            </span>
          </label>
        </fieldset>
      </form>
    </Modal>
  )
}

/** Cancel, styled to sit next to a primary button without importing it twice. */
function Ghostish({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-4 py-2.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-noir"
    >
      {label}
    </button>
  )
}

export default function AdminOrders() {
  const { locale, t } = useApp()
  const { call } = useAdmin()

  const [filters, setFilters] = useState(blank())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)

    const timer = setTimeout(() => {
      call((signal) => adminApi.orders(locale, {
        signal,
        search: filters.q,
        status: filters.status,
        start_date: filters.start_date,
        end_date: filters.end_date,
        page: filters.page,
      }))
        .then((d) => {
          if (alive) {
            setData(d)
            setError(null)
          }
        })
        .catch((e) => {
          if (alive) setError(e.message)
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    }, 250)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [locale, filters, call])

  const meta = data?.meta || {}
  const summary = data?.summary || {}
  const statuses = meta.statuses || []
  const counts = meta.counts || {}
  // The controller merges `statuses`/`counts` into the standard paginator `meta`.
  const orders = data?.data || []

  const money = (value) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-MA' : 'fr-MA', {
      style: 'currency',
      currency: 'MAD',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0)

  const created = (result) => {
    const ref = result?.order?.reference
    setNotice(ref ? t('admin', 'newOrderSaved', { reference: ref }) : t('admin', 'save'))
    // Re-fetch so the new order is in the list the owner is looking at, rather
    // than appearing only after a manual reload they may not think to do.
    setFilters((f) => ({ ...f, q: '', status: '', page: 1 }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin', 'orders')}
        actions={
          <PrimaryButton onClick={() => setCreating(true)}>{t('admin', 'newOrder')}</PrimaryButton>
        }
      />

      {error && <Banner>{error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}

      {/* What the filtered orders came to. Over the whole filtered set and
          not just the page on screen: the owner is asking what the shop took
          and what it earned. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t('admin', 'ordersTotalSales')}
          value={money(summary.total_sales ?? 0)}
          hint={t('admin', 'ordersCountHint', { count: summary.orders ?? 0 })}
          tone="accent"
        />
        <StatCard
          label={t('admin', 'ordersTotalBenefit')}
          value={money(summary.total_benefit ?? 0)}
          // The benefit is settled when the sale happens, so it is counted
          // over the delivered orders. An order still in flight has no
          // benefit yet, and saying so is truer than counting a figure that
          // may still change.
          hint={t('admin', 'ordersBenefitHint', { count: summary.settled_orders ?? 0 })}
        />
        <StatCard
          label={t('admin', 'ordersCost')}
          value={money(summary.total_cost ?? 0)}
          hint={t('admin', 'ordersCostHint')}
        />
      </div>

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <TextInput
              label={t('admin', 'search')}
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
              placeholder={t('admin', 'searchPlaceholder')}
            />
          </div>
          <div className="w-48">
            <Select
              label={t('admin', 'status')}
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            >
              <option value="">{t('admin', 'allStatuses')}</option>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({counts[s.value] ?? 0})
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <TextInput
              label={t('admin', 'ordersFrom')}
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value, page: 1 }))}
            />
          </div>
          <div className="w-44">
            <TextInput
              label={t('admin', 'ordersTo')}
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value, page: 1 }))}
            />
          </div>
          {loading && <span className="pb-2 text-xs font-medium uppercase tracking-widest text-stone-400">{t('common', 'loading')}</span>}
        </div>
      </Panel>

      <Panel bodyClassName="">
        {orders.length === 0 ? (
          <EmptyState title={t('admin', 'noOrders')} />
        ) : (
          <Table head={[t('admin', 'reference'), t('admin', 'customer'), t('admin', 'items'), t('admin', 'city'), t('admin', 'total'), t('admin', 'ordersBenefit'), t('admin', 'placedAt'), t('admin', 'status'), t('admin', 'actions')]}>
            {orders.map((o) => (
              <tr key={o.id} className="transition hover:bg-stone-50">
                <Td className="font-mono text-xs">{o.reference}</Td>
                <Td>
                  {o.customer?.name}
                  <span className="block text-xs text-stone-500" dir="ltr">{o.customer?.phone}</span>
                </Td>
                <Td className="max-w-72">
                  {/* One line per article, with the variant next to the name:
                      it is what decides which bottle leaves the shelf, so it
                      belongs to the line rather than to a detail screen the
                      owner then has to open for.

                      The line is clipped to the cell instead of running past
                      its border: the column is capped, and a nowrap line
                      inside a capped cell paints over the city next to it.
                      The name is the part that gives way — it is the longest
                      and the least decisive of the three — while the variant
                      and the quantity keep their room, and the whole name
                      rides the title for the hover. */}
                  <ul className="divide-y divide-stone-100 text-xs leading-snug text-stone-700">
                    {(o.items || []).map((i) => (
                      <li key={i.id} className="flex items-baseline gap-x-1 py-0.5 first:py-0">
                        <span className="min-w-0 truncate" title={i.name}>{i.name}</span>
                        {i.variant && (
                          <span className="max-w-24 shrink-0 truncate font-medium text-noir" title={i.variant}>
                            — {i.variant}
                          </span>
                        )}
                        <span className="shrink-0 text-stone-400">×{i.quantity}</span>
                      </li>
                    ))}
                    {(o.items || []).length === 0 && <li className="text-stone-300">—</li>}
                  </ul>
                </Td>
                <Td className="text-stone-600">{o.shipping?.city}</Td>
                <Td className="whitespace-nowrap">
                  {new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-MA' : 'fr-MA', {
                    style: 'currency',
                    currency: o.currency || 'MAD',
                    maximumFractionDigits: 0,
                  }).format(o.total)}
                </Td>
                {/* What the order earned: the total minus the purchase price
                    of what is in it. It is settled when the sale happens, so
                    an order still in flight shows a dash rather than a
                    number that may still change. */}
                <Td className="whitespace-nowrap text-stone-600">
                  {o.benefit === null || o.benefit === undefined ? (
                    <span className="text-stone-400">—</span>
                  ) : (
                    new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-MA' : 'fr-MA', {
                      style: 'currency',
                      currency: o.currency || 'MAD',
                      maximumFractionDigits: 0,
                    }).format(o.benefit)
                  )}
                </Td>
                <Td className="whitespace-nowrap text-stone-600">
                  {new Date(o.created_at).toLocaleString(locale)}
                  <span className="block text-[11px] font-medium uppercase tracking-wider text-stone-400">{o.locale}</span>
                </Td>
                <Td>
                  <Badge tone={o.status_color}>{o.status_label}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-end">
                  <div className="flex items-center justify-end gap-2">
                    {/* The customer's WhatsApp in one click. wa.me wants bare
                        international digits and the order keeps the phone
                        exactly as it was typed, so the link arrives built by
                        OrderResource through the shared normaliser — the panel
                        would otherwise be re-deciding the +212 rules here. A
                        row whose phone does not normalise renders nothing
                        rather than a link to nowhere. It opens a new tab
                        because the chat is an errand alongside this list, and
                        closing the message would otherwise close the place
                        the owner was reading. */}
                    {o.customer?.whatsapp_url && (
                      <a
                        href={o.customer.whatsapp_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={buttonClass('ghost')}
                      >
                        {/* The one green accent on the row: the glyph carries
                            in currentColor so the tone stays a style choice. */}
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4 text-emerald-600"
                          aria-hidden="true"
                        >
                          {SOCIAL_ICONS.whatsapp}
                        </svg>
                        {t('admin', 'contactWhatsapp')}
                      </a>
                    )}
                    <Link to={`/${locale}/admin/orders/${o.id}`} className={buttonClass()}>
                      {t('admin', 'view')}
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      {/* `meta`/`onPage`, not `page`/`lastPage`/`onChange`: Pagination reads the
          paginator's own links, and the old props meant it rendered nothing —
          so orders past the first page were unreachable from this screen. */}
      <Pagination
        meta={meta}
        onPage={(page) => setFilters((f) => ({ ...f, page: Number(page) || 1 }))}
      />

      <NewOrderModal
        locale={locale}
        t={t}
        call={call}
        open={creating}
        onClose={(result) => {
          setCreating(false)
          if (result?.order) created(result)
        }}
      />
    </div>
  )
}