import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { adminApi, imageUrl } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { prefillFromProduct } from '../../lib/productForm'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState, ErrorState, Spinner } from '../../components/Spinner'
import {
  Badge,
  Banner,
  ConfirmButton,
  GhostButton,
  PageHeader,
  Pagination,
  Panel,
  PrimaryButton,
  Table,
  Td,
  buttonClass,
} from '../../components/admin/Ui'

export default function AdminProducts() {
  const { locale, t } = useApp()
  const { call } = useAdmin()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [taxonomies, setTaxonomies] = useState({ brands: [], categories: [] })

  const query = useMemo(
    () => ({
      page: params.get('page') || 1,
      search: params.get('search') || undefined,
      brand: params.get('brand') || undefined,
      category: params.get('category') || undefined,
      active: params.get('active') || undefined,
    }),
    [params],
  )

  const load = useCallback(
    (signal) => {
      setLoading(true)
      setError(null)

      return call(() => adminApi.products(locale, query, { signal }))
        .then((d) => setData(d))
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message)
        })
        .finally(() => setLoading(false))
    },
    [locale, query, call],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  // Filter dropdowns need the full brand/category lists; both are small
  // unpaginated collections.
  useEffect(() => {
    let alive = true

    Promise.all([adminApi.brands(locale), adminApi.categories(locale)])
      .then(([b, c]) => {
        if (!alive) return
        setTaxonomies({ brands: b.data || [], categories: c.data || [] })
      })
      .catch(() => {})

    return () => {
      alive = false
    }
  }, [locale])

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value === '' || value === null || value === undefined) next.delete(key)
    else next.set(key, value)
    // Any filter change invalidates the current page number.
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const products = data?.data || []
  const meta = data?.meta

  const toggle = async (product) => {
    setNotice(null)
    try {
      const res = await call(() => adminApi.toggleProduct(locale, product.id))
      setData((d) => ({ ...d, data: d.data.map((p) => (p.id === product.id ? res.product : p)) }))
    } catch (e) {
      setError(e.message)
    }
  }

  /**
   * Starts a copy of a product instead of creating one now, so the merchant
   * adjusts the price or the photos before anything is written.
   *
   * The prefill travels in the navigation state rather than in the URL: it is
   * a form's worth of text, it is never a link anyone shares or reloads, and
   * putting it in a query string would risk a description landing in a
   * referrer. Nothing is fetched and nothing is stored yet.
   */
  const duplicate = (product) => {
    navigate(`/${locale}/admin/products/new`, {
      state: { prefill: prefillFromProduct(product) },
    })
  }

  const destroy = async (product) => {
    setNotice(null)
    try {
      await call(() => adminApi.deleteProduct(locale, product.id))
      setNotice(t('admin', 'trashed'))
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin', 'products')}
        actions={
          <Link to={`/${locale}/admin/products/new`} className={buttonClass()}>
            {t('admin', 'new')}
          </Link>
        }
      />

      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner>{error}</Banner>}

      <Panel bodyClassName="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={params.get('search') || ''}
            onChange={(e) => setParam('search', e.target.value)}
            placeholder={t('admin', 'searchPlaceholder')}
            aria-label={t('admin', 'search')}
            className="w-full border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gold"
          />
          <select
            value={params.get('brand') || ''}
            onChange={(e) => setParam('brand', e.target.value)}
            aria-label={t('admin', 'brand')}
            className="border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gold"
          >
            <option value="">{t('admin', 'brand')}</option>
            {taxonomies.brands.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={params.get('category') || ''}
            onChange={(e) => setParam('category', e.target.value)}
            aria-label={t('admin', 'category')}
            className="border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gold"
          >
            <option value="">{t('admin', 'category')}</option>
            {taxonomies.categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={params.get('active') || ''}
            onChange={(e) => setParam('active', e.target.value)}
            aria-label={t('admin', 'active')}
            className="border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gold"
          >
            <option value="">{t('admin', 'all')}</option>
            <option value="1">{t('admin', 'active')}</option>
            <option value="0">{t('admin', 'inactive')}</option>
          </select>
        </div>
      </Panel>

      <Panel>
        {loading && !data ? (
          <Spinner label={t('common', 'loading')} />
        ) : products.length === 0 ? (
          <EmptyState title={t('admin', 'noProducts')} />
        ) : (
          <>
            <Table
              head={[
                t('admin', 'name'),
                t('admin', 'sku'),
                t('admin', 'brand'),
                t('admin', 'price'),
                t('admin', 'stock'),
                t('admin', 'status'),
                t('admin', 'actions'),
              ]}
            >
              {products.map((p) => (
                <tr key={p.id} className="transition hover:bg-stone-50">
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="h-11 w-11 shrink-0 overflow-hidden bg-stone-100">
                        {p.preview?.url && (
                          <img src={imageUrl(p.preview.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <Link to={`/${locale}/admin/products/${p.id}`} className="block max-w-[16rem] truncate hover:text-gold">
                          {p.preview?.name || p.slug}
                        </Link>
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          {p.is_new && <Badge tone="jade">{t('admin', 'newFlag')}</Badge>}
                          {p.is_featured && <Badge tone="accent">{t('admin', 'featuredFlag')}</Badge>}
                        </span>
                      </span>
                    </div>
                  </Td>
                  <Td className="font-mono text-xs text-stone-600">{p.sku}</Td>
                  <Td className="text-stone-600">{p.brand?.name || '—'}</Td>
                  <Td className="whitespace-nowrap">
                    {formatPrice(p.price, locale)}
                    {p.compare_at_price && (
                      <span className="block text-xs text-stone-400 line-through">{formatPrice(p.compare_at_price, locale)}</span>
                    )}
                  </Td>
                  <Td>
                    <span className={p.stock === 0 ? 'text-rose-600' : p.stock <= 3 ? 'text-gold' : ''}>{p.stock}</span>
                  </Td>
                  <Td>
                    {p.is_active ? <Badge tone="accent">{t('admin', 'active')}</Badge> : <Badge>{t('admin', 'inactive')}</Badge>}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link to={`/${locale}/admin/products/${p.id}`} className={buttonClass('ghost')}>
                        {t('admin', 'edit')}
                      </Link>
                      <GhostButton onClick={() => duplicate(p)}>{t('admin', 'duplicate')}</GhostButton>
                      <GhostButton onClick={() => toggle(p)}>{p.is_active ? t('admin', 'inactive') : t('admin', 'active')}</GhostButton>
                      <ConfirmButton
                        label={t('admin', 'delete')}
                        confirmLabel={t('admin', 'confirm')}
                        onConfirm={() => destroy(p)}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
            <div className="px-5 py-4">
              <Pagination meta={meta} onPage={(page) => setParam('page', page)} />
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
