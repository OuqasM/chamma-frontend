import { useState } from 'react'
import { api } from '../lib/api'
import { useApp } from '../context/AppContext'

/**
 * The sold-out case on a product page: let a customer leave their number.
 *
 * Only the phone number, because it is the only thing the owner can act on. No
 * name, no email. The number is validated against the same Moroccan phone rule
 * the backend applies, and the consent is written explicitly below the field so
 * nobody can wonder why the number is being kept.
 *
 * The button toggles its text and becomes disabled while sending, and a
 * returning customer (duplicate) gets the same calm message as a new one — the
 * "already on the list" text is not a failure, it is the same outcome.
 */
export default function WaitlistForm({ product }) {
  const { locale, t } = useApp()
  const [phone, setPhone] = useState('')
  const [state, setState] = useState('idle') // idle | sending | success | duplicate | error
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (state === 'sending') return
    setError('')
    setState('sending')

    try {
      const res = await api.joinWaitlist(locale, product.slug, { phone })
      if (res?.waitlist?.created === false) {
        setState('duplicate')
      } else {
        setState('success')
        setPhone('')
      }
    } catch (err) {
      setState('error')
      setError(err?.message || t('product', 'waitlistError'))
    }
  }

  const disabled = state === 'sending' || state === 'success' || state === 'duplicate'

  if (state === 'success') {
    return (
      <div className="mt-6 rounded-md border border-jade/20 bg-jade/5 p-4 text-sm text-jade">
        {t('product', 'waitlistDone')}
      </div>
    )
  }

  if (state === 'duplicate') {
    return (
      <div className="mt-6 rounded-md border border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
        {t('product', 'waitlistAgain')}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 border-t border-stone-200 pt-6">
      <h2 className="font-serif text-lg text-noir">{t('product', 'waitlistTitle')}</h2>
      <p className="text-sm text-stone-600">{t('product', 'waitlistIntro')}</p>

      <label htmlFor="waitlist-phone" className="sr-only">
        {t('product', 'waitlistPhone')}
      </label>
      <input
        id="waitlist-phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t('product', 'waitlistPhoneHint')}
        required
        dir="ltr"
        inputMode="tel"
        className="w-full border border-stone-300 px-4 py-2 text-base text-stone-800 focus:border-gold focus:outline-none"
        disabled={disabled}
      />

      {state === 'error' && <p className="text-xs text-rose-700">{error}</p>}

      <button
        type="submit"
        disabled={disabled}
        className={`inline-flex items-center justify-center px-6 py-3 text-xs uppercase tracking-widest transition ${
          disabled ? 'cursor-not-allowed bg-stone-200 text-stone-500' : 'bg-noir text-white hover:bg-gold'
        }`}
      >
        {state === 'sending' ? t('product', 'waitlistSending') : t('product', 'waitlistCta')}
      </button>

      <p className="text-xs text-stone-500">{t('product', 'waitlistConsent')}</p>
    </form>
  )
}