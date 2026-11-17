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
  images: [],
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
  const [uploading, setUploading] = useState(false)
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
      images: review.image_path ? [review.image_path] : [],
      position: review.position ?? '',
      is_active: Boolean(review.is_active),
    })
  }

  /**
   * A review row holds one screenshot, so the create form turns a whole
   * selection into that many reviews; editing replaces the one this row has
   * (only the first file is taken there).
   *
   * Each file is a request of its own — the upload endpoint validates and
   * optimises one image — and the paths are handed to the API together so the
   * rows are written in one transaction.
   */
  const uploadImages = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    const accepted = editing?.id ? files.slice(0, 1) : files

    setUploading(true)
    setError(null)

    const paths = []
    let failure = null

    for (const file of accepted) {
      try {
        paths.push((await call(() => adminApi.upload(locale, file))).path)
      } catch (err) {
        failure = err
        break
      }
    }

    // Keep what did arrive, so a failure on the fourth file does not throw
    // away the three before it.
    if (paths.length > 0) {
      setForm((f) => ({ ...f, images: editing?.id ? paths : [...f.images, ...paths] }))
    }

    setUploading(false)

    if (failure) setError(failure.message)
  }

  const removeUploaded = (index) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (form.images.length === 0) return

    setSaving(true)
    setErrors({})
    setError(null)

    const body = {
      image: form.images[0],
      position: form.position === '' ? null : Number(form.position),
      is_active: form.is_active,
    }

    // `position` is NOT NULL with a column default, so a blank field has to be
    // omitted rather than sent as null.
    if (form.position === '') delete body.position

    try {
      if (editing?.id) {
        await call(() => adminApi.updateReview(locale, editing.id, body))
      } else {
        const payload = { images: form.images, is_active: form.is_active }

        // When an order is given, the screenshots are numbered from it in
        // selection order. Left blank, every row appends in creation order.
        if (form.position !== '') payload.position = Number(form.position)

        await call(() => adminApi.createReviews(locale, payload))
      }
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
            <PrimaryButton type="submit" form="review-form" disabled={saving || uploading || form.images.length === 0}>
              {saving ? t('admin', 'saving') : t('admin', 'save')}
            </PrimaryButton>
          </>
        }
      >
        <form id="review-form" onSubmit={submit} className="space-y-4">
          <div>
            <span className="text-[13px] font-medium text-stone-600">{t('admin', 'images')}</span>
            {form.images.length > 0 && (
              <ul className="mt-1.5 grid grid-cols-3 gap-2">
                {form.images.map((path, index) => (
                  <li key={`${path}-${index}`} className="relative">
                    <span className="flex h-32 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                      <img src={imageUrl(path)} alt="" className="h-full w-full object-cover" />
                    </span>
                    <button
                      type="button"
                      onClick={() => removeUploaded(index)}
                      className="absolute end-1 top-1 rounded-full bg-rose-600/95 px-2 py-0.5 text-[11px] font-medium text-white transition hover:bg-rose-700"
                    >
                      {t('admin', 'removeImage')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple={!editing?.id}
              onChange={uploadImages}
              disabled={uploading}
              className="mt-2 w-full text-xs text-stone-600 file:me-3 file:rounded-lg file:border file:border-stone-200 file:bg-ivory file:px-3 file:py-2 file:text-xs file:font-medium file:text-noir"
            />
            <p className="mt-1.5 text-xs text-stone-400">
              {editing?.id ? t('admin', 'uploadHint') : t('admin', 'reviewsBatchHint')}
            </p>
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
