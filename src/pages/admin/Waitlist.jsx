import { useEffect, useState } from 'react'
import { adminApi } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState } from '../../components/Spinner'
import { TextInput, Select } from '../../components/admin/Form'
import {
  Badge,
  Banner,
  GhostButton,
  PageHeader,
  Panel,
  Pagination,
  PrimaryButton,
  Table,
  Td,
} from '../../components/admin/Ui'

const blank = () => ({ product: '', status: 'pending', page: 1 })

/**
 * The back-in-stock list, from the owner's side.
 *
 * This page exists to be acted on, not read: every row has a WhatsApp link the
 * owner can open from the browser, and a button to mark a person as called. A
 * caller who works a page of numbers and then marks them has turned the list
 * back into a record of who was reached.
 *
 * There is no delete anywhere on this page. The numbers are people who gave
 * them, and a delete button next to a row would suggest the shop can erase that
 * a person was ever waiting. They are marked, and the product being removed
 * takes them with it.
 */
export default function AdminWaitlist() {
  const { locale, t } = useApp()
  const { call } = useAdmin()

  const [filters, setFilters] = useState(blank)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState({ product_id: '', phone: '' })

  useEffect(() => {
    let alive = true
    setLoading(true)

    call((signal) =>
      adminApi.waitlist(locale, {
        signal,
        product: filters.product || undefined,
        status: filters.status,
        page: filters.page,
      }),
    )
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

    return () => {
      alive = false
    }
  }, [locale, filters, call])

  const meta = data?.meta || {}
  const summary = data?.summary || {}
  const entries = data?.waitlist || []
  const products = data?.products || []
  const pending = filters.status === 'pending'

  const refresh = () => setFilters((f) => ({ ...f }))

  const markAll = async () => {
    setBusy(true)
    setError(null)
    try {
      // `product`, not `product_id`: this endpoint names the entries it is
      // marking rather than the product a new entry belongs to. It also refuses
      // an unscoped bulk mark, which is why the button only appears once a
      // product is chosen.
      //
      // 'pending' is sent literally rather than read off the filter: this
      // endpoint only accepts pending or all, and forwarding the filter's value
      // would send 'notified' and be rejected if the button were ever reachable
      // from the notified view.
      await call((signal) =>
        adminApi.markWaitlistNotified(locale, {
          product: filters.product,
          status: 'pending',
        }),
      )
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const markOne = async (id) => {
    setError(null)
    try {
      await call((signal) => adminApi.markWaitlistNotified(locale, { ids: [id] }))
      refresh()
    } catch (e) {
      setError(e.message)
    }
  }

  const addManual = async (e) => {
    e.preventDefault()
    if (!manual.product_id || !manual.phone) return
    setError(null)
    try {
      await call((signal) => adminApi.addToWaitlist(locale, manual))
      setManual({ product_id: '', phone: '' })
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const stat = (label, value) => (
    <div className="border border-stone-200 bg-ivory px-5 py-4">
      <p className="text-[11px] uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-noir">{value}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin', 'waitlist')}
        subtitle={t('admin', 'waitlistHint')}
      />

      {error && <Banner>{error}</Banner>}

      <div className="grid gap-3 sm:grid-cols-3">
        {stat(t('admin', 'waitlistPending'), summary.pending_total ?? 0)}
        {stat(t('admin', 'waitlistProducts'), summary.pending_products ?? 0)}
        {stat(t('admin', 'waitlistNotified'), summary.notified_total ?? 0)}
      </div>

      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Select
              label={t('admin', 'product')}
              value={filters.product}
              onChange={(e) => setFilters({ product: e.target.value, status: filters.status, page: 1 })}
            >
              <option value="">{t('admin', 'allProducts')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Select
              label={t('admin', 'status')}
              value={filters.status}
              onChange={(e) => setFilters({ product: filters.product, status: e.target.value, page: 1 })}
            >
              <option value="pending">{t('admin', 'waitlistPending')}</option>
              <option value="notified">{t('admin', 'waitlistNotified')}</option>
              <option value="all">{t('admin', 'allStatuses')}</option>
            </Select>
          </div>
          {pending && entries.length > 0 && (
            // Per product only. Marking every outstanding number in the shop in
            // one click is exactly the mistake a mis-click makes, and the API
            // refuses it, so the action is not offered unless it is scoped.
            <GhostButton
              onClick={markAll}
              disabled={busy || !filters.product}
              title={
                filters.product
                  ? undefined
                  : t('admin', 'waitlistMarkAllHint')
              }
              className="whitespace-nowrap"
            >
              {t('admin', 'waitlistMarkAll')}
            </GhostButton>
          )}
          {loading && (
            <span className="pb-2 text-xs uppercase tracking-widest text-stone-400">
              {t('common', 'loading')}
            </span>
          )}
        </div>
      </Panel>

      <Panel bodyClassName="">
        {entries.length === 0 ? (
          <EmptyState title={t('admin', 'waitlistEmpty')} />
        ) : (
          <Table
            head={[
              t('admin', 'phone'),
              t('admin', 'product'),
              t('admin', 'waitlistSince'),
              t('admin', 'status'),
              '',
            ]}
          >
            {entries.map((entry) => (
              <tr key={entry.id} className="transition hover:bg-stone-50">
                <Td>
                  <span className="font-mono text-sm text-stone-800" dir="ltr">
                    {entry.phone}
                  </span>
                </Td>
                <Td>
                  <span className="text-sm text-stone-700">{entry.product?.name || '—'}</span>
                  {!entry.product?.in_stock && (
                    <span className="block text-xs text-amber-600">
                      {t('admin', 'waitlistBackInStock')}
                    </span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-stone-600">
                  {entry.waiting_since ? new Date(entry.waiting_since).toLocaleString(locale) : '—'}
                </Td>
                <Td>
                  {entry.notified_at ? (
                    <Badge tone="jade">{t('admin', 'waitlistCalled')}</Badge>
                  ) : (
                    <Badge tone="amber">{t('admin', 'waitlistToCall')}</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-end">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={entry.whatsapp_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-xs uppercase tracking-widest text-gold hover:underline"
                    >
                      {t('admin', 'waitlistWhatsapp')}
                    </a>
                    {!entry.notified_at && (
                      <GhostButton onClick={() => markOne(entry.id)}>
                        {t('admin', 'waitlistMarkCalled')}
                      </GhostButton>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Pagination meta={meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />

      {/* A number taken over the phone, or written down in the shop. It goes
          through the same API as the online form, so the same person entered
          both ways stays one row. */}
      <Panel title={t('admin', 'waitlistAddTitle')}>
        <form onSubmit={addManual} className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Select
              label={t('admin', 'product')}
              value={manual.product_id}
              onChange={(e) => setManual({ ...manual, product_id: e.target.value })}
            >
              <option value="">{t('admin', 'waitlistChooseProduct')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-56">
            <TextInput
              label={t('admin', 'phone')}
              value={manual.phone}
              onChange={(e) => setManual({ ...manual, phone: e.target.value })}
              placeholder="0612345678"
            />
          </div>
          <PrimaryButton
            type="submit"
            disabled={!manual.product_id || !manual.phone}
          >
            {t('admin', 'waitlistAdd')}
          </PrimaryButton>
        </form>
      </Panel>
    </div>
  )
}
