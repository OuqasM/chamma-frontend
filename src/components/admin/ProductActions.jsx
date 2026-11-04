import { useState } from 'react'
import { adminApi } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'

/**
 * The two decisions the owner makes at the moment of the sale.
 *
 * A bottle that has just sold out, and a size that is discontinued for good.
 * Both are decisions the owner makes while writing the order or while handing
 * it over — the parcel is going out now, and the shop's stock and its sizes
 * should say so — and both were two screens away from where the decision is
 * actually made.
 *
 * **While the order is being written, the decisions wait for the save.** The
 * owner queues them and they travel with the order, so an order they abandon
 * leaves the shop's stock alone. On an order that is already saved there is
 * nothing to wait for, and the button does the thing.
 *
 * Neither ever touches the order itself: the line keeps the name it was
 * written with, which is what the history means.
 */
export default function ProductActions({
  productId,
  productName,
  variant,
  queuedStock = false,
  queuedVariant = false,
  onQueue,
  onChanged,
  className = '',
}) {
  const { locale, t } = useApp()
  const { call } = useAdmin()
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)

  const run = async (what, fn) => {
    setBusy(true)
    setSaid(null)

    try {
      await fn()
      setSaid(what)
      onChanged?.()
    } catch (err) {
      setSaid(err?.message || t('common', 'error'))
    } finally {
      setBusy(false)
    }
  }

  // While the order is being written, the decision is queued rather than
  // made: it travels with the order and is applied when the order is saved.
  const defer = (action) => {
    setSaid(null)
    onQueue?.(action)
  }

  const markOutOfStock = () => {
    if (onQueue) {
      defer({ type: 'out_of_stock', product_id: productId })
      return
    }

    run('outOfStock', () =>
      call((signal) => adminApi.setProductAvailability(locale, productId, false, { signal })),
    )
  }

  const removeVariant = () => {
    if (onQueue) {
      defer({ type: 'remove_variant', product_id: productId, variant })
      return
    }

    run('variantRemoved', () =>
      call((signal) => adminApi.removeVariant(locale, productId, variant, { signal })),
    )
  }

  const buttonClass =
    'rounded-lg border px-2 py-1 text-[11px] font-medium transition disabled:opacity-50'

  const state = (queued) =>
    queued
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-noir'

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={markOutOfStock}
        className={`${buttonClass} ${state(queuedStock)}`}
      >
        {queuedStock ? t('admin', 'queuedOutOfStock') : t('admin', 'markOutOfStock')}
      </button>

      {/* Only a product sold in sizes has a size to take off the list. */}
      {variant && (
        <button
          type="button"
          disabled={busy}
          onClick={removeVariant}
          className={`${buttonClass} ${state(queuedVariant)}`}
        >
          {queuedVariant ? t('admin', 'queuedVariantRemoved') : t('admin', 'removeVariant')}
        </button>
      )}

      {said === 'outOfStock' && (
        <span className="text-[11px] text-stone-500">
          {productName ? `${productName} — ` : ''}
          {t('admin', 'markedOutOfStock')}
        </span>
      )}

      {said === 'variantRemoved' && (
        <span className="text-[11px] text-stone-500">{t('admin', 'variantRemoved')}</span>
      )}

      {said && said !== 'outOfStock' && said !== 'variantRemoved' && (
        <span className="text-[11px] text-rose-600">{said}</span>
      )}
    </div>
  )
}
