import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminApi, imageUrl } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { ErrorState, Spinner } from '../../components/Spinner'
import { Select, TextInput, Toggle } from '../../components/admin/Form'
import { Badge, Banner, GhostButton, PageHeader, Panel, PrimaryButton, buttonClass } from '../../components/admin/Ui'

const GENDERS = ['women', 'men', 'unisex']
const MAX_IMAGES = 8

/**
 * The merchant never enters a stock count: one switch says whether the product
 * is buyable. "Available" parks the unit count well clear of the low-stock
 * threshold (<= 3) so the storefront only ever shows "En stock"; "not available"
 * writes 0, which is the out-of-stock state everywhere.
 */
const IN_STOCK = 100

const emptyForm = () => ({
  name: '',
  brand_id: '',
  category_id: '',
  // Server-owned: the URL follows the name. Kept only to build the "view on
  // store" link, refreshed from the response after every save.
  slug: '',
  price: '',
  cost_price: '',
  available: true,
  gender: '',
  is_new: false,
  short_description: '',
  description: '',
})

const numberOrNull = (value) => (value === '' || value === null ? null : Number(value))
const textOrNull = (value) => (value === '' ? null : value)

/**
 * The admin types the *full* (pre-discount) price plus a percentage, and the
 * discount is taken off that. The API stores the opposite pair — `price` is the
 * amount actually charged, `compare_at_price` the struck-through original — so
 * the arithmetic happens here and the form keeps the merchant's model.
 *
 * `price` is deliberately never re-derived on load into the form from the
 * charged amount, or re-saving would compound the discount every time.
 */
const MAX_DISCOUNT = 90
function pricingFor(fullPrice, discountPercent) {
  const full = Number(fullPrice)
  const d = Number(discountPercent)

  if (!Number.isFinite(full) || full <= 0) return { final: fullPrice, original: null, percent: 0 }
  if (!discountPercent || !Number.isFinite(d) || d <= 0) return { final: full, original: null, percent: 0 }

  const clamped = Math.min(d, MAX_DISCOUNT)
  let final = Math.round(full * (1 - clamped / 100))

  // The storefront only counts a product as discounted when the original is
  // strictly above the charged price, so rounding must never collapse the two.
  if (final >= full) final = Math.max(0, full - 0.01)

  return { final, original: full, percent: Math.round((1 - final / full) * 100) }
}

export default function AdminProductEdit() {
  const { id } = useParams()
  const { locale, t } = useApp()
  const { call } = useAdmin()
  const navigate = useNavigate()

  // `/admin/products/new` is its own route, so it arrives with no `:id` at all;
  // `new` is still accepted in case the path is ever reached as `products/:id`.
  const isNew = !id || id === 'new'

  const [form, setForm] = useState(emptyForm)
  const [images, setImages] = useState([])
  const [removed, setRemoved] = useState([])
  const [taxonomies, setTaxonomies] = useState({ brands: [], categories: [] })
  const [uploading, setUploading] = useState(false)

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  // A failed load replaces the page; a failed action only shows a banner, so a
  // validation error on save never blanks the form the admin is correcting.
  const [loadError, setLoadError] = useState(null)
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({})

  // Load the product (edit mode) and the two taxonomies the selects need.
  useEffect(() => {
    let alive = true

    Promise.all([adminApi.brands(locale), adminApi.categories(locale)])
      .then(([b, c]) => {
        if (alive) setTaxonomies({ brands: b.data || [], categories: c.data || [] })
      })
      .catch(() => {})

    if (isNew) {
      setLoading(false)
      return () => {
        alive = false
      }
    }

    setLoading(true)
    call(() => adminApi.product(locale, id))
      .then((d) => {
        if (!alive) return
        const p = d.product
        // The copy is shown and edited in one place: the English row. Other
        // locales keep whatever was translated before and are not exposed.
        const english = (p.translations || []).find((tr) => tr.locale === 'en')
          || (p.translations || [])[0]
          || {}

        setForm({
          name: p.name || '',
          brand_id: p.brand_id ?? '',
          category_id: p.category_id ?? '',
          slug: p.slug || '',
          // Form edits the full price; when discounted that is the struck
          // original, not the discounted amount the customer is charged.
          price: (p.discount_percent ?? 0) > 0 ? (p.compare_at_price ?? p.price) : (p.price ?? ''),
          cost_price: p.cost_price ?? '',
          // UI-only: never sent as-is, converted to compare_at_price on submit.
          discount: p.discount_percent ?? '',
          // One switch covers both halves of "can a shopper buy this": the
          // product has to be published and to have units on hand.
          available: Boolean(p.is_active) && Number(p.stock) > 0,
          gender: p.gender || '',
          is_new: Boolean(p.is_new),
          short_description: english.short_description || '',
          description: english.description || '',
        })
        setImages((p.images || []).map((img) => ({ id: img.id, path: img.path, url: img.url, is_primary: img.is_primary })))
        setError(null)
        setLoadError(null)
      })
      .catch((e) => {
        if (alive) setLoadError(e.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [id, isNew, locale, call])

  const setField = (key) => (e) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const setFlag = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const setCopy = (key) => (e) => {
    const value = e.target.value
    setForm((f) => ({
      ...f,
      [key]: value,
    }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const copyError = (field) => errors[field]?.[0]

  const addImage = async (result) => {
    setImages((list) => [...list, { path: result.path, url: imageUrl(result.url), is_primary: false }].slice(0, MAX_IMAGES))
  }

  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      await addImage(await call(() => adminApi.upload(locale, file)))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (index) => {
    setImages((list) => {
      const target = list[index]
      // Remembering the id is what tells the API to delete the stored file.
      if (target?.id) setRemoved((r) => [...r, target.id])
      return list.filter((_, i) => i !== index)
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setErrors({})

    const pricing = pricingFor(form.price, form.discount)

    const body = {
      name: form.name,
      brand_id: form.brand_id === '' ? null : Number(form.brand_id),
      category_id: form.category_id === '' ? null : Number(form.category_id),
      price: pricing.final,
      cost_price: numberOrNull(form.cost_price),
      compare_at_price: pricing.original,
      // The availability switch is the only stock input, so it drives both the
      // published flag and the unit count.
      is_active: form.available,
      stock: form.available ? IN_STOCK : 0,
      gender: textOrNull(form.gender),
      is_new: form.is_new,
      short_description: textOrNull(form.short_description),
      description: form.description,
      images: images.map((img) => img.path),
      remove_images: removed,
    }

    try {
      if (isNew) {
        const res = await call(() => adminApi.createProduct(locale, body))
        navigate(`/${locale}/admin/products/${res.product.id}`, { replace: true })
      } else {
        await call(() => adminApi.updateProduct(locale, id, body))
        // Re-read so server-normalised values (slug uniquifying, defaults) show.
        // Availability is re-read too: an order placed while this page was open
        // has already decremented the stock behind the toggle.
        const fresh = await call(() => adminApi.product(locale, id))
        setForm((f) => ({
          ...f,
          slug: fresh.product.slug,
          available: Boolean(fresh.product.is_active) && Number(fresh.product.stock) > 0,
        }))
        setError(null)
      }
    } catch (err) {
      setErrors(err.errors || {})
      setError(err.message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const brandOptions = useMemo(
    () => taxonomies.brands.map((b) => ({ value: b.id, label: b.name })),
    [taxonomies.brands],
  )
  const categoryOptions = useMemo(
    () => taxonomies.categories.map((c) => ({ value: c.id, label: c.name })),
    [taxonomies.categories],
  )

  // Live preview of what the storefront will show, so the merchant never has to
  // save to discover the struck-through price.
  const discountHint = useMemo(() => {
    const { final, original, percent } = pricingFor(form.price, form.discount)
    if (!original) return t('admin', 'discountHint')
    return t('admin', 'discountPreview', {
      final: formatPrice(final, locale),
      original: formatPrice(original, locale),
      percent,
    })
  }, [form.price, form.discount, locale, t])

  if (loading) return <Spinner label={t('common', 'loading')} />
  if (loadError) return <ErrorState message={loadError} />

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        title={isNew ? t('admin', 'new') : form.name || form.slug || t('admin', 'products')}
        actions={
          <>
            <Link to={`/${locale}/admin/products`} className={buttonClass('ghost')}>
              {t('admin', 'backToList')}
            </Link>
            {!isNew && form.slug && (
              <a href={`/${locale}/products/${form.slug}`} target="_blank" rel="noreferrer">
                <GhostButton type="button">{t('admin', 'viewOnStore')}</GhostButton>
              </a>
            )}
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? t('admin', 'saving') : t('admin', 'save')}
            </PrimaryButton>
          </>
        }
      />

      {error && <Banner>{error}</Banner>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel title={t('admin', 'product')} bodyClassName="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label={t('admin', 'name')}
                value={form.name}
                onChange={setField('name')}
                required
                error={errors.name?.[0]}
                hint={t('admin', 'nameOnceHint')}
              />
              <TextInput label={t('admin', 'price')} type="number" step="0.01" min="0" value={form.price} onChange={setField('price')} required error={errors.price?.[0]} />
              <TextInput
                label={t('admin', 'discount')}
                type="number"
                min="0"
                max={MAX_DISCOUNT}
                step="1"
                value={form.discount}
                onChange={setField('discount')}
                error={errors.compare_at_price?.[0]}
                hint={discountHint}
              />
              <TextInput
                label={t('admin', 'costPrice')}
                type="number"
                step="0.01"
                min="0"
                value={form.cost_price}
                onChange={setField('cost_price')}
                error={errors.cost_price?.[0]}
                hint={t('admin', 'costPriceHint')}
              />
              <Select
                label={t('admin', 'gender')}
                value={form.gender}
                onChange={setField('gender')}
                placeholder="—"
                options={GENDERS.map((g) => ({ value: g, label: t('admin', g) }))}
              />
              <Select
                label={t('admin', 'brand')}
                value={form.brand_id}
                onChange={setField('brand_id')}
                placeholder="—"
                options={brandOptions}
                error={errors.brand_id?.[0]}
              />
              <Select
                label={t('admin', 'category')}
                value={form.category_id}
                onChange={setField('category_id')}
                placeholder="—"
                options={categoryOptions}
                error={errors.category_id?.[0]}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Toggle
                label={t('admin', 'available')}
                hint={t('admin', 'availableHint')}
                checked={form.available}
                onChange={setFlag('available')}
              />
              <Toggle label={t('admin', 'isNew')} checked={form.is_new} onChange={setFlag('is_new')} />
            </div>
          </Panel>

          <Panel title={t('admin', 'descriptionTitle')} bodyClassName="p-5">
            <TextInput
              label={t('admin', 'shortDescription')}
              value={form.short_description}
              onChange={setCopy('short_description')}
              error={copyError('short_description')}
            />
            <TextInput
              className="mt-4"
              textarea
              rows={6}
              label={t('admin', 'description')}
              value={form.description}
              onChange={setCopy('description')}
              error={copyError('description')}
            />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={t('admin', 'images')} bodyClassName="p-5">
            {images.length === 0 ? (
              <p className="text-sm text-stone-500">{t('admin', 'noImage')}</p>
            ) : (
              <ul className="grid grid-cols-3 gap-3">
                {images.map((img, index) => (
                  <li key={img.path} className="relative">
                    <span className="block aspect-square overflow-hidden border border-stone-200 bg-stone-50">
                      <img src={imageUrl(img.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </span>
                    {img.is_primary && (
                      <span className="absolute start-0 top-0">
                        <Badge tone="accent">{t('admin', 'image')}</Badge>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute end-0 top-0 bg-rose-600 px-1.5 py-0.5 text-[11px] uppercase tracking-widest sm:text-xs text-white transition hover:bg-rose-700"
                    >
                      {t('admin', 'removeImage')}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
              <p className="text-xs text-stone-500">{t('admin', 'uploadHint')}</p>
              <label className="block">
                <span className="sr-only">{t('admin', 'upload')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  onChange={upload}
                  disabled={uploading || images.length >= MAX_IMAGES}
                  className="w-full text-xs text-stone-600 file:me-3 file:border file:border-stone-200 file:bg-white file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-widest"
                />
              </label>
            </div>
          </Panel>
        </div>
      </div>
    </form>
  )
}
