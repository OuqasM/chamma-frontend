import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminApi } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState } from '../../components/Spinner'
import { Banner, PageHeader, Panel, StatusBadge, Table, Td, buttonClass } from '../../components/admin/Ui'
/**
 * One customer, and the orders they placed.
 *
 * This is the page the owner opens when a number rings: who is this, what do
 * they live at, and what have they ordered before. The WhatsApp link is on the
 * page because the reason they are here is usually a call.
 */
export default function AdminCustomerDetail() {
  const { locale, t } = useApp()
  const { call } = useAdmin()
  const { id } = useParams()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)

    call((signal) => adminApi.customer(locale, id, { signal }))
      .then((d) => {
        if (!alive) return
        setData(d)
        setError(null)
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [locale, id, call])

  const customer = data?.customer
  const orders = data?.orders || []

  const money = (value) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-MA' : 'fr-MA', {
      style: 'currency',
      currency: 'MAD',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer?.name || t('admin', 'customers')}
        subtitle={customer?.phone}
        actions={
          <Link to={`/${locale}/admin/customers`} className={buttonClass('ghost')}>
            {t('admin', 'backToList')}
          </Link>
        }
      />

      {error && <Banner>{error}</Banner>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('admin', 'customersDetails')}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">
                {t('admin', 'phone')}
              </dt>
              <dd className="mt-0.5 font-mono text-noir" dir="ltr">
                {customer?.phone || '—'}
              </dd>
              {customer?.whatsapp_url && (
                <dd className="mt-1">
                  <a
                    href={customer.whatsapp_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs font-medium uppercase tracking-widest text-plum transition hover:text-noir hover:underline"
                  >
                    {t('admin', 'contactWhatsapp')}
                  </a>
                </dd>
              )}
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">
                {t('admin', 'city')}
              </dt>
              <dd className="mt-0.5 text-noir">{customer?.city || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">
                {t('admin', 'address')}
              </dt>
              <dd className="mt-0.5 text-noir">{customer?.address || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">
                {t('admin', 'customersOrders')}
              </dt>
              <dd className="mt-0.5 text-noir">{customer?.orders_count ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">
                {t('admin', 'customersSince')}
              </dt>
              <dd className="mt-0.5 text-noir">
                {customer?.since ? new Date(customer.since).toLocaleDateString(locale) : '—'}
              </dd>
            </div>
          </dl>
        </Panel>

        <div className="lg:col-span-2">
          <Panel title={t('admin', 'orders')} bodyClassName="">
            {orders.length === 0 ? (
              <EmptyState title={t('admin', 'customersNoOrders')} />
            ) : (
              <Table
                head={[
                  t('admin', 'reference'),
                  t('admin', 'placedAt'),
                  t('admin', 'city'),
                  t('admin', 'items'),
                  t('admin', 'total'),
                  t('admin', 'status'),
                  '',
                ]}
              >
                {orders.map((o) => (
                  <tr key={o.id} className="transition hover:bg-stone-50">
                    <Td className="font-mono text-xs">{o.reference}</Td>
                    <Td className="whitespace-nowrap text-stone-600">
                      {new Date(o.created_at).toLocaleString(locale)}
                    </Td>
                    <Td className="text-stone-600">{o.city || '—'}</Td>
                    <Td className="text-stone-600">{o.items_count}</Td>
                    <Td className="whitespace-nowrap text-stone-700">{money(o.total)}</Td>
                    <Td>
                      <StatusBadge label={o.status_label} color={o.status_color} />
                    </Td>
                    <Td className="whitespace-nowrap text-end">
                      <Link to={`/${locale}/admin/orders/${o.id}`} className={buttonClass('ghost')}>
                        {t('admin', 'view')}
                      </Link>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
