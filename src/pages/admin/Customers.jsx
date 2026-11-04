import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState } from '../../components/Spinner'
import { TextInput } from '../../components/admin/Form'
import {
  Badge,
  Banner,
  PageHeader,
  Pagination,
  Panel,
  StatCard,
  Table,
  Td,
  buttonClass,
} from '../../components/admin/Ui'

const blank = () => ({ q: '', page: 1 })

/**
 * The shop's customers.
 *
 * A customer is somebody who has ordered — the record is written by the order
 * itself, never typed in by hand, so this list cannot drift from the orders
 * that made it.
 *
 * The two numbers on each row are the ones that decide how to treat the person:
 * how many times they have ordered, and when they last did. Somebody with
 * three orders is a regular; somebody with one order from March is somebody to
 * recognise on the phone.
 *
 * The search takes a name or a number, and a number the way it is spoken:
 * "0612345678" finds the customer whose number is stored in the reduced form,
 * because the shop's own records would not find each other otherwise.
 */
export default function AdminCustomers() {
  const { locale, t } = useApp()
  const { call } = useAdmin()

  const [filters, setFilters] = useState(blank)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)

    // Debounced: the owner is typing a number they know, and every keystroke
    // is not a question worth a round trip.
    const timer = setTimeout(() => {
      call((signal) =>
        adminApi.customers(locale, {
          signal,
          search: filters.q,
          page: filters.page,
        }),
      )
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
    }, 250)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [locale, filters, call])

  const meta = data?.meta || {}
  const summary = data?.summary || {}
  const customers = data?.customers || []

  const money = (value) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-MA' : 'fr-MA', {
      style: 'currency',
      currency: 'MAD',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0)

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin', 'customers')} subtitle={t('admin', 'customersHint')} />

      {error && <Banner>{error}</Banner>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('admin', 'customersTotal')} value={summary.total ?? 0} tone="accent" />
        <StatCard label={t('admin', 'customersRepeat')} value={summary.repeat ?? 0} />
        <StatCard label={t('admin', 'customersNew')} value={summary.new_this_month ?? 0} />
      </div>

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <TextInput
              label={t('admin', 'search')}
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
              placeholder={t('admin', 'customersSearchPlaceholder')}
            />
          </div>
          {loading && (
            <span className="pb-2 text-xs font-medium uppercase tracking-widest text-stone-400">
              {t('common', 'loading')}
            </span>
          )}
        </div>
      </Panel>

      <Panel bodyClassName="">
        {customers.length === 0 ? (
          <EmptyState title={t('admin', 'customersEmpty')} />
        ) : (
          <Table
            head={[
              t('admin', 'name'),
              t('admin', 'phone'),
              t('admin', 'city'),
              t('admin', 'address'),
              t('admin', 'customersOrders'),
              t('admin', 'customersLastOrder'),
              '',
            ]}
          >
            {customers.map((c) => (
              <tr key={c.id} className="transition hover:bg-stone-50">
                <Td>
                  <span className="text-sm font-medium text-stone-900">{c.name}</span>
                  <span className="block text-xs text-stone-400">
                    {t('admin', 'customersSince')} {new Date(c.since).toLocaleDateString(locale)}
                  </span>
                </Td>
                <Td className="whitespace-nowrap font-mono text-sm text-stone-700" dir="ltr">
                  {c.phone}
                </Td>
                <Td className="text-stone-600">{c.city || '—'}</Td>
                <Td className="max-w-64 text-stone-600">
                  <span className="line-clamp-2">{c.address || '—'}</span>
                </Td>
                <Td>
                  {/* How many times they have ordered is what separates a
                      regular from somebody who called once. */}
                  {c.orders_count > 1 ? (
                    <Badge tone="accent">{c.orders_count}</Badge>
                  ) : (
                    <span className="text-sm text-stone-500">{c.orders_count}</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-stone-600">
                  {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString(locale) : '—'}
                </Td>
                <Td className="whitespace-nowrap text-end">
                  <Link to={`/${locale}/admin/customers/${c.id}`} className={buttonClass('ghost')}>
                    {t('admin', 'view')}
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page: Number(page) || 1 }))} />
    </div>
  )
}
