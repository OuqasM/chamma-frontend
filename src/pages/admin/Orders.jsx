import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, api } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState } from '../../components/Spinner'
import { SOCIAL_ICONS } from '../../components/SocialIcons'
import { Select, TextInput } from '../../components/admin/Form'
import {
  Badge,
  Banner,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  PrimaryButton,
  Table,
  Td,
  buttonClass,
} from '../../components/admin/Ui'

const blank = () => ({ q: '', status: '', page: 1 })

const emptyDraft = () => ({
  name: '',
  phone: '',
  city: '',
  address: '',
  notes: '',
  payment_method: '',
  payment_status: 'pending',
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
        phone: draft.phone,
        city: draft.city,
        address: draft.address,
        notes: draft.notes || null,
        payment_method: draft.payment_method,
        payment_status: draft.payment_status,
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

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label={t('checkout', 'name')}
              name="customer_name"
              autoComplete="name"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              required
            />
            <TextInput
              label={t('checkout', 'phone')}
              name="phone"
              autoComplete="tel"
              value={draft.phone}
              onChange={(e) => set({ phone: e.target.value })}
              dir="ltr"
              inputMode="tel"
              required
            />
            <Select
              label={t('checkout', 'city')}
              name="city"
              value={draft.city}
              onChange={(e) => set({ city: e.target.value })}
              required
            >
              <option value="">{t('checkout', 'cityPlaceholder')}</option>
              {(options?.cities || []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
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
                {!draft.city
                  ? '—'
                  : quote
                    ? quote.shipping_cost === 0
                      ? t('common', 'free')
                      : money(quote.shipping_cost)
                    : '…'}
              </dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-2 font-medium text-noir">
              <dt>{t('cart', 'total')}</dt>
              <dd>{quote ? money(quote.total) : '…'}</dd>
            </div>
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
              {t('admin', 'newOrderMarkPaid')}
              <span className="block text-xs text-stone-500">{t('admin', 'newOrderMarkPaidHint')}</span>
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
  const statuses = meta.statuses || []
  const counts = meta.counts || {}
  // The controller merges `statuses`/`counts` into the standard paginator `meta`.
  const orders = data?.data || []

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
          {loading && <span className="pb-2 text-xs font-medium uppercase tracking-widest text-stone-400">{t('common', 'loading')}</span>}
        </div>
      </Panel>

      <Panel bodyClassName="">
        {orders.length === 0 ? (
          <EmptyState title={t('admin', 'noOrders')} />
        ) : (
          <Table head={[t('admin', 'reference'), t('admin', 'customer'), t('admin', 'items'), t('admin', 'city'), t('admin', 'total'), t('admin', 'placedAt'), t('admin', 'status'), t('admin', 'actions')]}>
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
                      owner then has to open for. */}
                  <ul className="divide-y divide-stone-100 text-xs leading-snug text-stone-700">
                    {(o.items || []).map((i) => (
                      <li key={i.id} className="whitespace-nowrap py-0.5 first:py-0">
                        <span className="inline-block max-w-48 truncate align-middle">{i.name}</span>
                        {i.variant && (
                          <span className="font-medium text-noir"> — {i.variant}</span>
                        )}
                        <span className="text-stone-400"> ×{i.quantity}</span>
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