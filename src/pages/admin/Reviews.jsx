import { useEffect, useState } from 'react'
import { adminApi, imageUrl } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { EmptyState, ErrorState, Spinner } from '../../components/Spinner'
import { TextInput, Toggle } from '../../components/admin/Form'
import { ActionMenu, Badge, Banner, GhostButton, Modal, PageHeader, Panel, PrimaryButton, Table, Td } from '../../components/admin/Ui'

// A review is a screenshot, a place in the order, and an on/off switch —
// nothing is translated, because a conversation is not translated.
const blank = () => ({
  image: '',
  position: '',
  is_active: true,
})

export default function AdminReviews() {
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
    return call(() => adminApi.reviews(locale))
      .then(setData)
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    let alive = true
    call(() => adminApi.reviews(locale))
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

  const open = (review) => {
    setErrors({})
    setNotice(null)

    if (!review) {
      setEditing({ id: null })
      setForm(blank())
      return
    }

    setEditing({ id: review.id })
    setForm({
      image: review.image_path || '',
      position: review.position ?? '',
      is_active: Boolean(review.is_active),
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
      image: form.image,
      position: form.position === '' ? null : Number(form.position),
      is_active: form.is_active,
    }

    // `position` is NOT NULL with a column default, so a blank field has to be
    // omitted rather than sent as null.
    if (form.position === '') delete body.position

    try {
      if (editing?.id) await call(() => adminApi.updateReview(locale, editing.id, body))
      else await call(() => adminApi.createReview(locale, body))
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

  const destroy = async (review) => {
    setError(null)
    setNotice(null)
    try {
      await call(() => adminApi.deleteReview(locale, review.id))
      setNotice(t('admin', 'delete'))
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !data) return <ErrorState message={error} />
  if (!data) return <Spinner label={t('common', 'loading')} />

  const reviews = data.data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin', 'reviews')}
        actions={<PrimaryButton onClick={() => open(null)}>{t('admin', 'create')}</PrimaryButton>}
      />

      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner>{error}</Banner>}

      <Panel>
        {reviews.length === 0 ? (
          <EmptyState title={t('admin', 'noReviews')} />
        ) : (
          <Table head={['', t('admin', 'position'), t('admin', 'status'), t('admin', 'actions')]}>
            {reviews.map((r) => (
              <tr key={r.id} className="transition hover:bg-stone-50">
                <Td>
                  <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-stone-100">
                    {r.image ? (
                      <img src={imageUrl(r.image)} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-[11px] text-stone-400 sm:text-xs">{t('admin', 'noImage')}</span>
                    )}
                  </span>
                </Td>
                <Td className="text-stone-600">{r.position}</Td>
                <Td>{r.is_active ? <Badge tone="accent">{t('admin', 'active')}</Badge> : <Badge>{t('admin', 'inactive')}</Badge>}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <GhostButton onClick={() => open(r)}>{t('admin', 'edit')}</GhostButton>
                    <ActionMenu
                      label={t('admin', 'actions')}
                      items={[
                        {
                          key: 'delete',
                          label: t('admin', 'delete'),
                          confirmLabel: t('admin', 'confirm'),
                          tone: 'danger',
                          onClick: () => destroy(r),
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
            <PrimaryButton type="submit" form="review-form" disabled={saving || !form.image}>
              {saving ? t('admin', 'saving') : t('admin', 'save')}
            </PrimaryButton>
          </>
        }
      >
        <form id="review-form" onSubmit={submit} className="space-y-4">
          <div>
            <span className="text-[13px] font-medium text-stone-600">{t('admin', 'image')}</span>
            {form.image && (
              <span className="mt-1.5 flex h-40 w-28 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                <img src={imageUrl(form.image)} alt="" className="h-full w-full object-cover" />
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={uploadImage}
              className="mt-2 w-full text-xs text-stone-600 file:me-3 file:rounded-lg file:border file:border-stone-200 file:bg-ivory file:px-3 file:py-2 file:text-xs file:font-medium file:text-noir"
            />
            <p className="mt-1.5 text-xs text-stone-400">{t('admin', 'uploadHint')}</p>
          </div>

          <TextInput
            label={t('admin', 'position')}
            type="number"
            min="0"
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
            error={errors.position?.[0]}
          />

          <Toggle label={t('admin', 'active')} checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
        </form>
      </Modal>
    </div>
  )
}
