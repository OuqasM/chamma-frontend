import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, imageUrl } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState, ErrorState, Spinner } from '../../components/Spinner'
import { Badge, PageHeader, Panel, StatusBadge, Table, Td } from '../../components/admin/Ui'

/** Card keys the dashboard reports, mapped to their labels. */
const CARDS = [
  { key: 'revenue', label: 'revenue' },
  { key: 'orders', label: 'totalOrders' },
  { key: 'pending', label: 'toProcess' },
  { key: 'products', label: 'totalProducts' },
  { key: 'low_stock', label: 'lowStock' },
  { key: 'out_of_stock', label: 'outOfStock' },
  { key: 'brands', label: 'totalBrands' },
  { key: 'categories', label: 'totalCategories' },
]

function formatDate(iso, locale) {
  if (!iso) return '—'
  const tag = { fr: 'fr-MA', ar: 'ar-MA', en: 'en-GB' }[locale] || 'fr-MA'
  try {
    return new Intl.DateTimeFormat(tag, { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export default function AdminDashboard() {
  const { locale, t } = useApp()
  const { call } = useAdmin()

  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true

    call(() => adminApi.dashboard(locale))
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })

    return () => {
      alive = false
    }
  }, [locale, call])

  if (error) return <ErrorState message={error} />
  if (!data) return <Spinner label={t('common', 'loading')} />

  const cards = Object.fromEntries((data.cards || []).map((c) => [c.key, c]))
  const recentOrders = data.recent_orders || []
  const lowStock = data.low_stock_products || []

  return (
    <div className="space-y-8">
      <PageHeader title={t('admin', 'dashboard')} subtitle={t('admin', 'last30')} />

      <div className="grid gap-px border border-stone-200 bg-stone-200 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map(({ key, label }) => {
          const card = cards[key]
          return (
            <div key={key} className="bg-white px-5 py-4">
              <p className="text-[10px] uppercase tracking-widest text-stone-500">{t('admin', label)}</p>
              <p className="mt-1.5 font-serif text-2xl text-noir">
                {card ? (card.currency ? formatPrice(card.value, locale) : card.value) : '—'}
              </p>
            </div>
          )
        })}
      </div>

      <Panel
        title={t('admin', 'recentOrders')}
        className="overflow-hidden"
        bodyClassName=""
        actions={
          <Link to={`/${locale}/admin/orders`} className="text-xs uppercase tracking-widest text-stone-500 hover:text-gold">
            {t('home', 'viewAll')}
          </Link>
        }
      >
        {recentOrders.length === 0 ? (
          <EmptyState title={t('admin', 'noOrders')} />
        ) : (
          <Table head={[t('admin', 'reference'), t('admin', 'customer'), t('admin', 'city'), t('admin', 'date'), t('admin', 'total'), t('admin', 'status'), '']}>
            {recentOrders.map((o) => (
              <tr key={o.id} className="transition hover:bg-stone-50">
                <Td>
                  <Link to={`/${locale}/admin/orders/${o.id}`} className="font-mono text-xs hover:text-gold">
                    {o.reference}
                  </Link>
                </Td>
                <Td>{o.customer_name}</Td>
                <Td className="text-stone-600">{o.city}</Td>
                <Td className="whitespace-nowrap text-stone-600">{formatDate(o.created_at, locale)}</Td>
                <Td className="whitespace-nowrap">{formatPrice(o.total, locale)}</Td>
                <Td>
                  <StatusBadge label={o.status_label} color={o.status_color} />
                </Td>
                <Td>
                  <Link to={`/${locale}/admin/orders/${o.id}`} className="text-xs uppercase tracking-widest text-stone-500 hover:text-gold">
                    {t('admin', 'edit')}
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title={t('admin', 'lowStockProducts')}>
        {lowStock.length === 0 ? (
          <EmptyState title={t('admin', 'noResults')} />
        ) : (
          <ul className="divide-y divide-stone-200">
            {lowStock.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="h-11 w-11 shrink-0 overflow-hidden bg-stone-100">
                  {p.image ? (
                    <img src={imageUrl(p.image)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <Link to={`/${locale}/admin/products/${p.id}`} className="block truncate text-sm hover:text-gold">
                    {p.name}
                  </Link>
                  <span className="font-mono text-xs text-stone-500">{p.sku}</span>
                </span>
                {p.stock === 0 ? (
                  <Badge tone="danger">{t('admin', 'outOfStock')}</Badge>
                ) : (
                  <Badge tone="accent">
                    {t('product', 'lowStock', { n: p.stock })}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
