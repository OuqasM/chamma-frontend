import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { adminApi, imageUrl } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { ErrorState, Spinner } from '../../components/Spinner'
import { MultiSelect, Select, TextInput, Toggle } from '../../components/admin/Form'
import { dictionaries } from '../../lib/i18n'
import { COPY_LOCALES, copyFromTranslations, emptyCopy } from '../../lib/productForm'
import { listReturnQuery } from '../../lib/listReturn'
import { Badge, Banner, GhostButton, PageHeader, Panel, PrimaryButton, buttonClass } from '../../components/admin/Ui'

const GENDERS = ['women', 'men', 'unisex']
const MAX_IMAGES = 8

/**
 * A new product starts published and available, with a unit count comfortably
 * clear of the low-stock threshold so the storefront reads "En stock".
 */
const DEFAULT_STOCK = 100

const emptyForm = () => ({
  name: '',
  brand_id: '',
  category_ids: [],
  // Server-owned: the URL follows the name. Kept only to build the "view on
  // store" link, refreshed from the response after every save.
  slug: '',
  price: '',
  cost_price: '',
  // `is_active` hides the product from the storefront; `is_available` only
  // controls the out-of-stock label. They are set independently from here on.
  is_active: true,
  is_available: true,
  stock: DEFAULT_STOCK,
  gender: '',
  // One short and one long description per language, each optional: a language
  // left blank is simply not written, and the storefront then shows the copy of
  // a language that is filled rather than an empty block.
  short_descriptions: emptyCopy(),
  descriptions: emptyCopy(),
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
  const { state } = useLocation()
  // Filters the list was showing, carried in the URL when it linked here.
  const [listParams] = useSearchParams()

  // The list's own filters, so coming back lands where the admin left off.
  const listQuery = listReturnQuery(listParams)

  // `/admin/products/new` is its own route, so it arrives with no `:id` at all;
  // `new` is still accepted in case the path is ever reached as `products/:id`.
  const isNew = !id || id === 'new'

  // Set only by the Duplicate button, which hands the open form to a fresh
  // `/new` render. Router state, not storage: a refresh on `/new` then gives an
  // honestly blank form rather than silently re-filling from a stale entry.
  const prefill = state?.prefill

  // The lazy form has to be *called*: handing `useState` the function itself
  // stores the function as the state value, and every `form.x` below then reads
  // off a function and the page renders blank.
  const [form, setForm] = useState(() => (prefill ? { ...emptyForm(), ...prefill } : emptyForm()))
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
        // The copy is read per language, so each one can be edited or left
        // blank independently.
        setForm({
          name: p.name || '',
          brand_id: p.brand_id ?? '',
          category_ids: (p.category_ids ?? []).map(Number),
          slug: p.slug || '',
          // Form edits the full price; when discounted that is the struck
          // original, not the discounted amount the customer is charged.
          price: (p.discount_percent ?? 0) > 0 ? (p.compare_at_price ?? p.price) : (p.price ?? ''),
          cost_price: p.cost_price ?? '',
          // UI-only: never sent as-is, converted to compare_at_price on submit.
          discount: p.discount_percent ?? '',
          // The two switches answer different questions and are sent as two
          // separate flags: `is_active` decides whether the product is on the
          // storefront at all, `is_available` only whether it reads as buyable
          // or gets the out-of-stock label.
          is_active: Boolean(p.is_active),
          is_available: Boolean(p.is_available ?? true),
          stock: p.stock ?? 0,
          gender: p.gender || '',
          short_descriptions: copyFromTranslations(p.translations, 'short_description'),
          descriptions: copyFromTranslations(p.translations, 'description'),
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

  // For the controls that are not <input> elements and therefore have no event
  // to read a value off. It also drops the field's error, the way setField
  // does, so a corrected field stops showing the previous run's message.
  const setValue = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const setFlag = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  /**
   * One language, one field. The error key is dotted (`descriptions.fr`) so it
   * matches the validation key the API reports for that exact input.
   */
  const setCopy = (group) => (locale) => (e) => {
    const value = e.target.value
    const key = `${group}.${locale}`

    setForm((f) => ({ ...f, [group]: { ...f[group], [locale]: value } }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const copyError = (group) => (locale) => errors[`${group}.${locale}`]?.[0]

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
      category_ids: form.category_ids,
      price: pricing.final,
      cost_price: numberOrNull(form.cost_price),
      compare_at_price: pricing.original,
      // Two independent flags, and the unit count is its own number again:
      // marking a product unavailable no longer unpublishes it or rewrites how
      // many units it has.
      is_active: form.is_active,
      is_available: form.is_available,
      stock: Number(form.stock) || 0,
      gender: textOrNull(form.gender),
      // Keyed by language, so the API can tell "French is blank" from "French
      // was not submitted": only a submitted key is written.
      short_descriptions: form.short_descriptions,
      descriptions: form.descriptions,
      images: images.map((img) => img.path),
      remove_images: removed,
    }

    try {
      if (isNew) {
        await call(() => adminApi.createProduct(locale, body))
      } else {
        await call(() => adminApi.updateProduct(locale, id, body))
      }

      // Saving sends the admin back to the list, for both creating and editing:
      // the list is where the next product is opened from, so staying on a form
      // that is now redundant only costs a trip. `replace` keeps the saved
      // product out of the history, so Back returns to wherever the admin came
      // from rather than re-opening a form they have already submitted.
      navigate(`/${locale}/admin/products${listQuery}`, { replace: true })
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
            <Link to={`/${locale}/admin/products${listQuery}`} className={buttonClass('ghost')}>
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
          <Panel title={t('admin', 'product')} bodyClassName="px-6 py-5">
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
              <MultiSelect
                label={t('admin', 'categories')}
                options={categoryOptions}
                value={form.category_ids}
                onChange={setValue('category_ids')}
                hint={t('admin', 'categoriesHint')}
                error={errors.category_ids?.[0]}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TextInput
                label={t('admin', 'stock')}
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={setField('stock')}
                error={errors.stock?.[0]}
              />
            </div>

            {/* The two are deliberately separate: unpublishing takes the product
                off the storefront, marking it unavailable leaves it listed and
                only changes the label to out of stock. */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Toggle
                label={t('admin', 'active')}
                hint={t('admin', 'activeHint')}
                checked={form.is_active}
                onChange={setFlag('is_active')}
              />
              <Toggle
                label={t('admin', 'available')}
                hint={t('admin', 'availableHint')}
                checked={form.is_available}
                onChange={setFlag('is_available')}
              />
            </div>
          </Panel>

          <Panel title={t('admin', 'descriptionTitle')} bodyClassName="px-6 py-5">
            <p className="mb-4 text-xs text-stone-500">{t('admin', 'descriptionHint')}</p>

            {COPY_LOCALES.map((code) => (
              <fieldset
                key={code}
                // A group per language, so the heading separates them for
                // screen readers as well as visually.
                className="mb-5 border-t border-stone-100 pt-4 last:mb-0 last:border-0"
              >
                <legend className="sr-only">{dictionaries[code].localeName}</legend>
                <p className="mb-2 text-sm font-medium text-noir">{dictionaries[code].localeName}</p>

                <TextInput
                  label={t('admin', 'shortDescription')}
                  value={form.short_descriptions[code]}
                  onChange={setCopy('short_descriptions')(code)}
                  error={copyError('short_descriptions')(code)}
                />
                <TextInput
                  className="mt-4"
                  textarea
                  rows={6}
                  label={t('admin', 'description')}
                  value={form.descriptions[code]}
                  onChange={setCopy('descriptions')(code)}
                  error={copyError('descriptions')(code)}
                  hint={t('admin', 'descriptionMarkdown')}
                />
              </fieldset>
            ))}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={t('admin', 'images')} bodyClassName="px-6 py-5">
            {images.length === 0 ? (
              <p className="text-sm text-stone-500">{t('admin', 'noImage')}</p>
            ) : (
              <ul className="grid grid-cols-3 gap-3">
                {images.map((img, index) => (
                  <li key={img.path} className="relative">
                    <span className="block aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                      <img src={imageUrl(img.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </span>
                    {img.is_primary && (
                      <span className="absolute start-1 top-1">
                        <Badge tone="accent">{t('admin', 'image')}</Badge>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute end-1 top-1 rounded-full bg-rose-600/95 px-2 py-0.5 text-[11px] font-medium text-white transition hover:bg-rose-700"
                    >
                      {t('admin', 'removeImage')}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
              <p className="text-xs text-stone-500">{t('admin', 'uploadHint')}</p>
              <label className="block">
                <span className="sr-only">{t('admin', 'upload')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  onChange={upload}
                  disabled={uploading || images.length >= MAX_IMAGES}
                  className="w-full text-xs text-stone-600 file:me-3 file:rounded-lg file:border file:border-stone-200 file:bg-ivory file:px-3 file:py-2 file:text-xs file:font-medium file:text-noir"
                />
              </label>
            </div>
          </Panel>
        </div>
      </div>
    </form>
  )
}
