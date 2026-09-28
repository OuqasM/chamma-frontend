import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../lib/api'
import { LOCALES } from '../../lib/i18n'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState, ErrorState, Spinner } from '../../components/Spinner'
import { Select, TextInput } from '../../components/admin/Form'
import { Badge, Banner, PageHeader, Panel, Pagination, Table, Td, buttonClass } from '../../components/admin/Ui'

const blank = () => ({ q: '', status: '', page: 1 })

export default function AdminOrders() {
  const { locale, t } = useApp()
  const { call } = useAdmin()

  const [filters, setFilters] = useState(blank())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin', 'orders')} />

      {error && <Banner>{error}</Banner>}

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

      {meta.last_page > 1 && (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
      )}
    </div>
  )
}
