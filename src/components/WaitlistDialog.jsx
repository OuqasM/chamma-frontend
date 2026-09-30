import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import WaitlistForm from './WaitlistForm'

/**
 * "Notify me" from a product card.
 *
 * A card cannot host the form itself. The grid gives every card in a row the
 * height of its tallest sibling, so expanding a form inline would stretch
 * every card beside it and break the alignment the card deliberately reserves
 * two lines of name for. A dialog holds one card's worth of type at its own
 * size and leaves the grid alone.
 *
 * It follows the storefront drawer's conventions rather than the admin Modal:
 * portalled to <body> so no transformed ancestor can trap `position: fixed`,
 * Escape to dismiss, the page behind locked against scrolling, and focus moved
 * in on open so a keyboard shopper lands on the phone field rather than the
 * backdrop.
 */
export default function WaitlistDialog({ product, onClose }) {
  const { t } = useApp()
  const panelRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // The field, not the panel: autofocusing the container would scroll the
  // dialog's own heading off the top on a short screen.
  useEffect(() => {
    panelRef.current?.querySelector('input')?.focus()
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label={t('common', 'close')}
        onClick={onClose}
        className="fixed inset-0 bg-noir/50 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        className="relative w-full max-w-sm bg-ivory p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common', 'close')}
          className="absolute end-4 top-4 text-stone-400 transition hover:text-noir"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="pe-8 font-serif text-xl leading-snug text-noir">{product.name}</h2>
        <p className="mt-1 text-sm text-stone-600">{t('product', 'waitlistIntro')}</p>

        <div className="mt-5">
          {/* Remounted per product so opening another card's dialog shows an
              empty field rather than the previous customer's number and
              success message. */}
          <WaitlistForm key={product.id} product={product} compact />
        </div>
      </div>
    </div>,
    document.body,
  )
}