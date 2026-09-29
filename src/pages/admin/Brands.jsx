import { useEffect, useState } from 'react'
import { adminApi, imageUrl } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState, ErrorState, Spinner } from '../../components/Spinner'
import { TextInput, Toggle } from '../../components/admin/Form'
import { ActionMenu, Badge, Banner, GhostButton, Modal, PageHeader, Panel, PrimaryButton, Table, Td } from '../../components/admin/Ui'

// Everything is entered once: a brand is called the same thing in every
// language, and there is no per-language input in this form at all.
const blank = () => ({
  name: '',
  slug: '',
  origin: '',
  logo: '',
  position: '',
  is_active: true,
  tagline: '',
  description: '',
})

export default function AdminBrands() {
  const { locale, t } = useApp()
  const { call } = useAdmin()

  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank())
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const load = () => {
    setError(null)
    return call(() => adminApi.brands(locale))
      .then(setData)
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    let alive = true
    call(() => adminApi.brands(locale))
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

  const open = (brand) => {
    setErrors({})
    setNotice(null)

    if (!brand) {
      setEditing({ id: null })
      setForm(blank())
      return
    }

    // Seeded from the English row; locales translated before keep their own
    // copy and are not exposed here.
    const english = (brand.translations || []).find((tr) => tr.locale === 'en')
      || (brand.translations || [])[0]
      || {}

    setEditing({ id: brand.id, name: brand.name })
    setForm({
      name: brand.name || '',
      slug: brand.slug || '',
      origin: brand.origin || '',
      logo: brand.logo_path || '',
      position: brand.position ?? '',
      is_active: Boolean(brand.is_active),
      tagline: english.tagline || '',
      description: english.description || '',
    })
  }

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const res = await call(() => adminApi.upload(locale, file))
      setForm((f) => ({ ...f, logo: res.path }))
    } catch (err) {
      setError(err.message)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setError(null)

    const body = {
      name: form.name,
      slug: form.slug === '' ? null : form.slug,
      origin: form.origin === '' ? null : form.origin,
      logo: form.logo === '' ? null : form.logo,
      position: form.position === '' ? null : Number(form.position),
      is_active: form.is_active,
      tagline: form.tagline === '' ? null : form.tagline,
      description: form.description === '' ? null : form.description,
    }

    // `position` is NOT NULL with a column default, so a blank field has to be
    // omitted rather than sent as null.
    if (form.position === '') delete body.position

    try {
      if (editing?.id) await call(() => adminApi.updateBrand(locale, editing.id, body))
      else await call(() => adminApi.createBrand(locale, body))
      setEditing(null)
      setNotice(t('admin', 'save'))
      await load()
    } catch (err) {
      setErrors(err.errors || {})
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const destroy = async (brand) => {
    setError(null)
    setNotice(null)
    try {
      await call(() => adminApi.deleteBrand(locale, brand.id))
      setNotice(t('admin', 'delete'))
      await load()
    } catch (err) {
      // The API refuses to delete a brand that still has products.
      setError(err.message)
    }
  }

  if (error && !data) return <ErrorState message={error} />
  if (!data) return <Spinner label={t('common', 'loading')} />

  const brands = data.data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin', 'brands')}
        actions={<PrimaryButton onClick={() => open(null)}>{t('admin', 'create')}</PrimaryButton>}
      />

      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner>{error}</Banner>}

      <Panel>
        {brands.length === 0 ? (
          <EmptyState title={t('admin', 'noBrands')} />
        ) : (
          <Table head={[t('admin', 'logo'), t('admin', 'name'), t('admin', 'origin'), t('admin', 'products'), t('admin', 'status'), t('admin', 'actions')]}>
            {brands.map((b) => (
              <tr key={b.id} className="transition hover:bg-stone-50">
                <Td>
                  <span className="flex h-10 w-16 items-center justify-center overflow-hidden bg-stone-100">
                    {b.logo ? (
                      <img src={imageUrl(b.logo)} alt="" className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <span className="text-[11px] text-stone-400 sm:text-xs">{t('admin', 'noImage')}</span>
                    )}
                  </span>
                </Td>
                <Td>
                  {b.name}
                  {b.tagline && <span className="block text-xs text-stone-500">{b.tagline}</span>}
                </Td>
                <Td className="text-stone-600">{b.origin || '—'}</Td>
                <Td className="text-stone-600">{b.products_count ?? 0}</Td>
                <Td>{b.is_active ? <Badge tone="accent">{t('admin', 'active')}</Badge> : <Badge>{t('admin', 'inactive')}</Badge>}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a href={b.url} target="_blank" rel="noreferrer">
                      <GhostButton>{t('admin', 'viewOnStore')}</GhostButton>
                    </a>
                    <GhostButton onClick={() => open(b)}>{t('admin', 'edit')}</GhostButton>
                    <ActionMenu
                      label={t('admin', 'actions')}
                      items={[
                        {
                          key: 'delete',
                          label: t('admin', 'delete'),
                          confirmLabel: t('admin', 'confirm'),
                          tone: 'danger',
                          onClick: () => destroy(b),
                        },
                      ]}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? t('admin', 'edit') : t('admin', 'create')}
        footer={
          <>
            <GhostButton type="button" onClick={() => setEditing(null)}>
              {t('admin', 'cancel')}
            </GhostButton>
            <PrimaryButton type="submit" form="brand-form" disabled={saving}>
              {saving ? t('admin', 'saving') : t('admin', 'save')}
            </PrimaryButton>
          </>
        }
      >
        <form id="brand-form" onSubmit={submit} className="space-y-4">
          <TextInput
            label={t('admin', 'name')}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={errors.name?.[0]}
            hint={t('admin', 'nameOnceHint')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label={t('admin', 'slug')} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} error={errors.slug?.[0]} />
            <TextInput label={t('admin', 'origin')} value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} error={errors.origin?.[0]} />
          </div>
          <TextInput label={t('admin', 'position')} type="number" min="0" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} error={errors.position?.[0]} />

          <div>
            <span className="text-xs uppercase tracking-widest text-stone-400">{t('admin', 'logo')}</span>
            {form.logo && (
              <span className="mt-1.5 flex h-16 w-28 items-center justify-center overflow-hidden border border-stone-200 bg-stone-50">
                <img src={imageUrl(form.logo)} alt="" className="h-full w-full object-contain" />
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={uploadLogo}
              className="mt-2 w-full text-xs text-stone-600 file:me-3 file:border file:border-stone-200 file:bg-white file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-widest"
            />
          </div>

          <Toggle label={t('admin', 'active')} checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />

          <TextInput
            label={t('admin', 'tagline')}
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            error={errors.tagline?.[0]}
          />
          <TextInput
            textarea
            rows={3}
            label={t('admin', 'description')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            error={errors.description?.[0]}
          />
        </form>
      </Modal>
    </div>
  )
}
