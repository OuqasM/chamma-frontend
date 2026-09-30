import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, api } from '../../lib/api'
import { LOCALES } from '../../lib/i18n'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState } from '../../components/Spinner'
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
  email: '',
  city: '',
  address: '',
  notes: '',
  payment_method: '',
  payment_status: 'pending',
  locale: '',
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

  const addItem = (product) => {
    setDraft((d) => {
      // Adding the same product twice should raise its quantity, not create two
      // rows that then have to be reconciled to get the right order.
      const existing = d.items.find((i) => i.product_id === product.id)
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
            product_id: product.id,
            name: product.name,
            price: product.price,
            stock: product.stock,
            quantity: 1,
          },
        ],
      }
    })
    setSearch('')
    setMatches([])
  }

  const setQuantity = (productId, quantity) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.product_id === productId ? { ...i, quantity: Math.max(1, Number(quantity) || 1) } : i,
      ),
    }))

  const removeItem = (productId) =>
    setDraft((d) => ({ ...d, items: d.items.filter((i) => i.product_id !== productId) }))

  const close = () => {
    // Throw away the draft rather than leaving it behind the next time the
    // owner opens this for a different customer.
    setDraft(emptyDraft())
    setSearch('')
    setMatches([])
    setError(null)
    onClose()
  }

  const save = async (e) => {
    e.preventDefault()
    if (saving || draft.items.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const body = {
        name: draft.name,
        phone: draft.phone,
        email: draft.email || null,
        city: draft.city,
        address: draft.address,
        notes: draft.notes || null,
        payment_method: draft.payment_method,
        payment_status: draft.payment_status,
        locale: draft.locale || null,
        // Only the two fields the server needs. `name`/`price`/`stock` above
        // are for display; sending them would invite the server to trust a
        // label the owner typed.
        items: draft.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
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
          <PrimaryButton type="submit" form="new-order-form" disabled={saving || draft.items.length === 0}>
            {saving ? t('admin', 'saving') : t('admin', 'save')}
          </PrimaryButton>
        </>
      }
    >
      <form id="new-order-form" onSubmit={save} className="space-y-6">
        <p className="text-sm text-stone-600">{t('admin', 'newOrderHint')}</p>

        {error && <Banner>{error}</Banner>}

        <fieldset className="space-y-3">
          <legend className="text-xs uppercase tracking-widest text-stone-400">
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
            <TextInput
              label={t('checkout', 'email')}
              name="email"
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(e) => set({ email: e.target.value })}
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
          <legend className="text-xs uppercase tracking-widest text-stone-400">
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
              <ul className="mt-1 max-h-56 overflow-auto border border-stone-200 bg-white">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => addItem(p)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
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
            <ul className="divide-y divide-stone-100 border border-stone-200">
              {draft.items.map((item) => (
                <li key={item.product_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="min-w-40 flex-1 truncate text-sm text-stone-800">{item.name}</span>

                  {tooMany(item) && (
                    <Badge tone="danger">
                      {t('admin', 'outOfStock')} ({item.stock})
                    </Badge>
                  )}

                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => setQuantity(item.product_id, e.target.value)}
                    aria-label={t('admin', 'quantity')}
                    className="w-20 border border-stone-300 px-2 py-1 text-sm focus:border-gold focus:outline-none"
                  />
                  <span className="w-24 text-right text-sm text-stone-600">
                    {money((Number(item.price) || 0) * item.quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.product_id)}
                    className="text-xs uppercase tracking-widest text-stone-400 hover:text-rose-700"
                  >
                    {t('admin', 'newOrderRemoveItem')}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-right text-sm text-stone-700">
            <span className="text-stone-500">{t('checkout', 'orderSummary')}: </span>
            <strong>{money(estimate)}</strong>
          </p>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs uppercase tracking-widest text-stone-400">
            {t('admin', 'newOrderPaymentMethod')}
          </legend>

          <div className="grid gap-3 sm:grid-cols-2">
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

            <Select
              label={t('admin', 'locale')}
              value={draft.locale}
              onChange={(e) => set({ locale: e.target.value })}
            >
              <option value="">{t('admin', 'orderLocale')}</option>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={draft.payment_status === 'paid'}
              onChange={(e) =>
                set({ payment_status: e.target.checked ? 'paid' : 'pending' })
              }
              className="mt-1"
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
      className="px-4 py-2 text-xs uppercase tracking-widest text-stone-500 hover:text-stone-800"
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
          {loading && <span className="pb-2 text-xs uppercase tracking-widest text-stone-400">{t('common', 'loading')}</span>}
        </div>
      </Panel>

      <Panel bodyClassName="">
        {orders.length === 0 ? (
          <EmptyState title={t('admin', 'noOrders')} />
        ) : (
          <Table head={[t('admin', 'reference'), t('admin', 'customer'), t('admin', 'city'), t('admin', 'total'), t('admin', 'placedAt'), t('admin', 'status'), t('admin', 'actions')]}>
            {orders.map((o) => (
              <tr key={o.id} className="transition hover:bg-stone-50">
                <Td className="font-mono text-xs">{o.reference}</Td>
                <Td>
                  {o.customer?.name}
                  <span className="block text-xs text-stone-500" dir="ltr">{o.customer?.phone}</span>
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
                  <span className="block text-xs uppercase tracking-widest text-stone-400">{o.locale}</span>
                </Td>
                <Td>
                  <Badge tone={o.status_color}>{o.status_label}</Badge>
                </Td>
                <Td>
                  <Link to={`/${locale}/admin/orders/${o.id}`} className={buttonClass()}>
                    {t('admin', 'view')}
                  </Link>
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