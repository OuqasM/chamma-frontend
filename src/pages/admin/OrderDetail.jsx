import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminApi, imageUrl } from '../../lib/api'
import { LOCALES } from '../../lib/i18n'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { ErrorState, Spinner } from '../../components/Spinner'
import { Select } from '../../components/admin/Form'
import { Badge, Banner, Panel, PrimaryButton, StatusBadge, Table, Td, buttonClass } from '../../components/admin/Ui'

/**
 * `payment_status` arrives as a raw enum value, so it is mapped to a translated
 * label and a badge tone here rather than being printed as-is.
 */
const PAYMENT_KEYS = { pending: 'pendingPayment', paid: 'paid', refunded: 'refunded' }
const PAYMENT_TONES = { pending: 'neutral', paid: 'jade', refunded: 'danger' }

/** One label/value line in a status panel's definition list. */
function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-xs uppercase tracking-widest text-stone-400">{label}</dt>
      <dd className="text-right text-sm text-stone-700">{children}</dd>
    </div>
  )
}

const money = (value, currency, locale) =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-MA' : 'fr-MA', {
    style: 'currency',
    currency: currency || 'MAD',
    maximumFractionDigits: 0,
  }).format(value || 0)

export default function AdminOrderDetail() {
  const { id } = useParams()
  const { locale, t } = useApp()
  const { call } = useAdmin()

  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [statuses, setStatuses] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true

    Promise.all([call(() => adminApi.order(locale, id)), call(() => adminApi.orders(locale, { per_page: 1 }))])
      .then(([detail, list]) => {
        if (!alive) return
        setOrder(detail.order)
        setStatuses(list.meta?.statuses || [])
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })

    return () => {
      alive = false
    }
  }, [id, locale, call])

  const changeStatus = async (next) => {
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const res = await call(() => adminApi.updateOrderStatus(locale, id, next))
      setOrder(res.order)
      setNotice(t('admin', 'statusUpdated'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (error && !order) return <ErrorState message={error} />
  if (!order) return <Spinner label={t('common', 'loading')} />

  const closed = !order.next_status

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-stone-400">{t('admin', 'order')}</p>
          <h1 className="text-2xl font-light tracking-wide text-stone-900">{order.reference}</h1>
        </div>
        <Link to={`/${locale}/admin/orders`} className={buttonClass('ghost')}>
          {t('admin', 'backToOrders')}
        </Link>
      </div>

      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner>{error}</Banner>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title={t('admin', 'items')} bodyClassName="">
            <Table head={[t('admin', 'product'), t('admin', 'unitPrice'), t('admin', 'quantity'), t('admin', 'lineTotal')]}>
              {order.items?.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="h-14 w-12 shrink-0 overflow-hidden bg-stone-100">
                        {item.image && <img src={imageUrl(item.image)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      </span>
                      <span>
                        {item.name}
                        {item.sku && <span className="block font-mono text-xs text-stone-500">{item.sku}</span>}
                      </span>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{money(item.unit_price, order.currency, locale)}</Td>
                  <Td>{item.quantity}</Td>
                  <Td className="whitespace-nowrap">{money(item.subtotal, order.currency, locale)}</Td>
                </tr>
              ))}
            </Table>

            <dl className="mt-4 space-y-1 border-t border-stone-200 pt-4 text-sm">
              <div className="flex justify-between text-stone-600">
                <dt>{t('admin', 'subtotal')}</dt>
                <dd>{money(order.subtotal, order.currency, locale)}</dd>
              </div>
              <div className="flex justify-between text-stone-600">
                <dt>{t('admin', 'shipping')}</dt>
                <dd>{money(order.shipping_cost, order.currency, locale)}</dd>
              </div>
              <div className="flex justify-between text-base text-stone-900">
                <dt>{t('admin', 'total')}</dt>
                <dd>{money(order.total, order.currency, locale)}</dd>
              </div>
            </dl>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={t('admin', 'status')}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={order.status_label} color={order.status_color} />
              <Badge tone={PAYMENT_TONES[order.payment_status] || 'neutral'}>
                {t('admin', PAYMENT_KEYS[order.payment_status] || 'paymentStatus')}
              </Badge>
            </div>

            <dl className="mt-4 divide-y divide-stone-100 border-t border-stone-200">
              <Row label={t('admin', 'method')}>
                {order.payment_method_label || order.payment_method}
              </Row>
              <Row label={t('admin', 'placedAt')}>
                <time dateTime={order.created_at}>
                  {new Date(order.created_at).toLocaleString(locale)}
                </time>
              </Row>
            </dl>

            {closed ? (
              <p className="mt-4 border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
                {t('admin', 'orderClosed')}
              </p>
            ) : (
              <div className="mt-4 border-t border-stone-200 pt-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[10rem] flex-1">
                    <Select
                      label={t('admin', 'changeStatus')}
                      value={order.status}
                      onChange={(e) => changeStatus(e.target.value)}
                      disabled={saving}
                    >
                      {statuses.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <PrimaryButton
                    type="button"
                    disabled={saving || order.status === order.next_status}
                    onClick={() => changeStatus(order.next_status)}
                  >
                    {saving ? t('admin', 'saving') : `${t('admin', 'advance')} →`}
                  </PrimaryButton>
                </div>
                {order.next_status && (
                  <p className="mt-2 text-xs text-stone-500">
                    {t('admin', 'advanceTo')}:{' '}
                    <span className="text-stone-700">
                      {statuses.find((s) => s.value === order.next_status)?.label}
                    </span>
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel title={t('admin', 'customer')}>
            <p className="font-serif text-lg text-stone-900">{order.customer?.name}</p>

            <dl className="mt-3 space-y-1.5 text-sm">
              {order.customer?.phone && (
                <div className="flex items-baseline gap-2">
                  <dt className="w-20 shrink-0 text-xs uppercase tracking-widest text-stone-400">
                    {t('admin', 'phone')}
                  </dt>
                  <dd>
                    <a href={`tel:${order.customer.phone}`} dir="ltr" className="text-stone-700 hover:text-gold">
                      {order.customer.phone}
                    </a>
                  </dd>
                </div>
              )}
              {order.customer?.email && (
                <div className="flex items-baseline gap-2">
                  <dt className="w-20 shrink-0 text-xs uppercase tracking-widest text-stone-400">
                    {t('admin', 'email')}
                  </dt>
                  <dd className="min-w-0">
                    <a
                      href={`mailto:${order.customer.email}`}
                      dir="ltr"
                      className="block truncate text-stone-700 hover:text-gold"
                    >
                      {order.customer.email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            <h3 className="mt-5 border-t border-stone-200 pt-4 text-xs uppercase tracking-widest text-stone-400">
              {t('admin', 'shippingDetails')}
            </h3>
            <p className="mt-2 text-sm text-stone-900">{order.shipping?.city}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-stone-600">{order.shipping?.address}</p>
            {order.shipping?.notes && (
              <p className="mt-3 border-s-2 border-gold/40 ps-3 text-sm italic text-stone-500">
                {order.shipping.notes}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
