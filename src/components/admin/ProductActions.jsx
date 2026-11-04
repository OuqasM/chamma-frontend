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
 * The actions are deliberately quiet: a product that is out of stock is not
 * deleted and a size is not taken off the shelf quietly. They say what they
 * did, and the order itself is never touched — the line keeps the name it was
 * written with, which is what the history means.
 */
export default function ProductActions({ productId, productName, variant, onChanged, className = '' }) {
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

  const markOutOfStock = () =>
    run('outOfStock', () =>
      call((signal) => adminApi.setProductAvailability(locale, productId, false, { signal })),
    )

  const removeVariant = () =>
    run('variantRemoved', () =>
      call((signal) => adminApi.removeVariant(locale, productId, variant, { signal })),
    )

  const buttonClass =
    'rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-500 transition hover:border-stone-300 hover:text-noir disabled:opacity-50'

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <button type="button" disabled={busy} onClick={markOutOfStock} className={buttonClass}>
        {t('admin', 'markOutOfStock')}
      </button>

      {/* Only a product sold in sizes has a size to take off the list. */}
      {variant && (
        <button type="button" disabled={busy} onClick={removeVariant} className={buttonClass}>
          {t('admin', 'removeVariant')}
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
