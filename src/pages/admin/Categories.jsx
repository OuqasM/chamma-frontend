import { useEffect, useState } from 'react'
import { adminApi, imageUrl } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState, ErrorState, Spinner } from '../../components/Spinner'
import { Select, TextInput, Toggle } from '../../components/admin/Form'
import { ActionMenu, Badge, Banner, GhostButton, Modal, PageHeader, Panel, PrimaryButton, Table, Td } from '../../components/admin/Ui'

// The name is entered once — it is a label, not copy, so it is not translated.
// The per-locale rows below carry only the fields that genuinely differ.
const blank = () => ({
  name: '',
  slug: '',
  image: '',
  position: '',
  is_active: true,
  description: '',
  meta_title: '',
  meta_description: '',
})

export default function AdminCategories() {
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
    return call(() => adminApi.categories(locale))
      .then(setData)
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    let alive = true
    call(() => adminApi.categories(locale))
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

  const open = (category) => {
    setErrors({})
    setNotice(null)

    if (!category) {
      setEditing({ id: null })
      setForm(blank())
      return
    }

    // One set of copy fields, seeded from the English row. Locales translated
    // before keep their own copy and are not exposed here.
    const english = (category.translations || []).find((tr) => tr.locale === 'en')
      || (category.translations || [])[0]
      || {}

    setEditing({ id: category.id, name: category.name })
    setForm({
      name: category.name || '',
      slug: category.slug || '',
      image: category.image_path || '',
      position: category.position ?? '',
      is_active: Boolean(category.is_active),
      description: english.description || '',
      meta_title: english.meta_title || '',
      meta_description: english.meta_description || '',
    })
  }

  const uploadImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const res = await call(() => adminApi.upload(locale, file))
      setForm((f) => ({ ...f, image: res.path }))
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
      image: form.image === '' ? null : form.image,
      position: form.position === '' ? null : Number(form.position),
      is_active: form.is_active,
      description: form.description,
      meta_title: form.meta_title === '' ? null : form.meta_title,
      meta_description: form.meta_description === '' ? null : form.meta_description,
    }

    // `position` is NOT NULL with a column default, so a blank field has to be
    // omitted rather than sent as null.
    if (form.position === '') delete body.position

    try {
      if (editing?.id) await call(() => adminApi.updateCategory(locale, editing.id, body))
      else await call(() => adminApi.createCategory(locale, body))
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

  const destroy = async (category) => {
    setError(null)
    setNotice(null)
    try {
      await call(() => adminApi.deleteCategory(locale, category.id))
      setNotice(t('admin', 'delete'))
      await load()
    } catch (err) {
      // A category that still has products is refused by the API.
      setError(err.message)
    }
  }

  if (error && !data) return <ErrorState message={error} />
  if (!data) return <Spinner label={t('common', 'loading')} />

  const categories = data.data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin', 'categories')}
        actions={<PrimaryButton onClick={() => open(null)}>{t('admin', 'create')}</PrimaryButton>}
      />

      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner>{error}</Banner>}

      <Panel>
        {categories.length === 0 ? (
          <EmptyState title={t('admin', 'noCategories')} />
        ) : (
          <Table head={[t('admin', 'image'), t('admin', 'name'), t('admin', 'slug'), t('admin', 'position'), t('admin', 'status'), t('admin', 'actions')]}>
            {categories.map((c) => (
              <tr key={c.id} className="transition hover:bg-stone-50">
                <Td>
                  <span className="block h-12 w-16 overflow-hidden bg-stone-100">
                    {c.image?.url && <img src={imageUrl(c.image.url)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  </span>
                </Td>
                <Td>{c.name}</Td>
                <Td className="font-mono text-xs text-stone-600">{c.slug}</Td>
                <Td className="text-stone-600">{c.position}</Td>
                <Td>{c.is_active ? <Badge tone="accent">{t('admin', 'active')}</Badge> : <Badge>{t('admin', 'inactive')}</Badge>}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Kept as a real anchor opening a new tab: the storefront can
                        be on another host, which a router link cannot navigate to. */}
                    <a href={c.url} target="_blank" rel="noreferrer">
                      <GhostButton>{t('admin', 'viewOnStore')}</GhostButton>
                    </a>
                    <GhostButton onClick={() => open(c)}>{t('admin', 'edit')}</GhostButton>
                    <ActionMenu
                      label={t('admin', 'actions')}
                      items={[
                        {
                          key: 'delete',
                          label: t('admin', 'delete'),
                          confirmLabel: t('admin', 'confirm'),
                          tone: 'danger',
                          onClick: () => destroy(c),
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
            <PrimaryButton type="submit" form="category-form" disabled={saving}>
              {saving ? t('admin', 'saving') : t('admin', 'save')}
            </PrimaryButton>
          </>
        }
      >
        <form id="category-form" onSubmit={submit} className="space-y-4">
          <TextInput
            label={t('admin', 'name')}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={errors.name?.[0]}
            hint={t('admin', 'nameOnceHint')}
          />
          <TextInput label={t('admin', 'slug')} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} error={errors.slug?.[0]} />
          <TextInput
            label={t('admin', 'position')}
            type="number"
            min="0"
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
            error={errors.position?.[0]}
          />

          <div>
            <span className="text-xs uppercase tracking-widest text-stone-400">{t('admin', 'image')}</span>
            {form.image && (
              <span className="mt-1.5 block h-24 w-32 overflow-hidden border border-stone-200 bg-stone-50">
                <img src={imageUrl(form.image)} alt="" className="h-full w-full object-cover" />
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={uploadImage}
              className="mt-2 w-full text-xs text-stone-600 file:me-3 file:border file:border-stone-200 file:bg-white file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-widest"
            />
          </div>

          <Toggle label={t('admin', 'active')} checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />

          <TextInput
            textarea
            rows={3}
            label={t('admin', 'description')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            error={errors.description?.[0]}
          />
          <TextInput
            label={t('admin', 'metaTitle')}
            value={form.meta_title}
            onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))}
            error={errors.meta_title?.[0]}
          />
          <TextInput
            label={t('admin', 'metaDescription')}
            value={form.meta_description}
            onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))}
            error={errors.meta_description?.[0]}
          />
        </form>
      </Modal>
    </div>
  )
}
