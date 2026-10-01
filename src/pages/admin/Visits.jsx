import { useEffect, useState } from 'react'
import { adminApi } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState } from '../../components/Spinner'
import { Select } from '../../components/admin/Form'
import { Badge, Banner, PageHeader, Panel, Pagination, Table, Td } from '../../components/admin/Ui'

const blank = () => ({ device: '', page: 1 })

/**
 * The four device classes `VisitorTracker` can emit. Spelled out because the
 * value is a Tailwind-independent filter sent to the API, not a class name.
 */
const DEVICE_TONES = {
  desktop: 'neutral',
  mobile: 'accent',
  tablet: 'jade',
  other: 'neutral',
}

export default function AdminVisits() {
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
      call((signal) => adminApi.visits(locale, {
        signal,
        device: filters.device,
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
  const visits = data?.visits || []
  const devices = data?.filters?.devices || []
  const byDevice = summary.by_device || {}

  const stat = (label, value) => (
    <div className="border border-stone-200 bg-ivory px-5 py-4">
      <p className="text-[11px] uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-noir">{value}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin', 'visits')}
        subtitle={t('admin', 'visitsHint')}
      />

      {error && <Banner>{error}</Banner>}

      {/* One row per IP address, so "addresses" and "visitors" rarely match:
          several people behind the same address collapse into a single row. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stat(t('admin', 'visitors'), summary.visitors ?? 0)}
        {stat(t('admin', 'addresses'), summary.total ?? 0)}
        {stat(t('admin', 'pageViews'), summary.page_views ?? 0)}
        {stat(t('admin', 'visitorsLast24h'), summary.last_24h ?? 0)}
      </div>

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Select
              label={t('admin', 'device')}
              value={filters.device}
              onChange={(e) => setFilters({ device: e.target.value, page: 1 })}
            >
              <option value="">{t('admin', 'allDevices')}</option>
              {devices.map((d) => (
                <option key={d} value={d}>
                  {t('admin', `device_${d}`)} ({byDevice[d] ?? 0})
                </option>
              ))}
            </Select>
          </div>
          {loading && <span className="pb-2 text-xs uppercase tracking-widest text-stone-400">{t('common', 'loading')}</span>}
        </div>
      </Panel>

      <Panel bodyClassName="">
        {visits.length === 0 ? (
          <EmptyState title={t('admin', 'noVisits')} />
        ) : (
          <Table
            head={[
              t('admin', 'ipAddress'),
              t('admin', 'device'),
              t('admin', 'browser'),
              t('admin', 'visitors'),
              t('admin', 'visitsCount'),
              t('admin', 'lastSeen'),
            ]}
          >
            {visits.map((v) => (
              <tr key={v.ip ?? 'unknown'} className="transition hover:bg-stone-50">
                <Td>
                  <span className="font-mono text-xs text-stone-600" dir="ltr">{v.ip || '—'}</span>
                </Td>
                <Td>
                  <Badge tone={DEVICE_TONES[v.device] || 'neutral'}>{t('admin', `device_${v.device}`)}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-stone-600">{v.browser || '—'}</Td>
                <Td className="whitespace-nowrap font-semibold">{v.visitors ?? 0}</Td>
                <Td className="whitespace-nowrap font-semibold">{v.visits_count ?? 0}</Td>
                <Td className="whitespace-nowrap text-stone-600">{v.last_seen ? new Date(v.last_seen).toLocaleString(locale) : '—'}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
    </div>
  )
}