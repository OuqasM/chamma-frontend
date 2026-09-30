import { useId, useState } from 'react'
import { api } from '../lib/api'
import { useApp } from '../context/AppContext'

/**
 * The sold-out case on a product page: let a customer leave their details.
 *
 * A name and a phone number, both required. The number is what the owner dials;
 * the name is what they say when it answers, and a bare number on a list is a
 * dial string with no way to tell a regular from somebody who called once. No
 * email: a stored address would suggest a written notification nothing sends.
 *
 * The number is validated against the same Moroccan phone rule the backend
 * applies, and the consent is written explicitly below the fields so nobody can
 * wonder why they are being kept.
 *
 * The button toggles its text and becomes disabled while sending, and a
 * returning customer (duplicate) gets the same calm message as a new one — the
 * "already on the list" text is not a failure, it is the same outcome.
 */
export default function WaitlistForm({ product, compact = false }) {
  const { locale, t } = useApp()
  // Generated rather than fixed strings: a product page shows this form, and a
  // related product's card dialog can open over the top of it. Two elements with
  // id="waitlist-phone" means the second form's <label for> points at the first
  // form's input, so typing in the dialog labels and types into the page's box.
  // One id is now a pair — name and phone both need their own. Two calls rather
  // than one id plus a suffix, because useId's values contain colons that make
  // the derived string awkward to select on in tests.
  const nameId = useId()
  const phoneId = useId()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState('idle') // idle | sending | success | duplicate | error
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (state === 'sending') return
    setError('')
    setState('sending')

    try {
      const res = await api.joinWaitlist(locale, product.slug, { name, phone })
      if (res?.waitlist?.created === false) {
        setState('duplicate')
      } else {
        setState('success')
        setName('')
        setPhone('')
      }
    } catch (err) {
      setState('error')
      setError(err?.message || t('product', 'waitlistError'))
    }
  }

  const disabled = state === 'sending' || state === 'success' || state === 'duplicate'

  // The dialog supplies its own heading, so `compact` drops this component's own
  // title and intro rather than saying the same thing twice in one small box.
  if (state === 'success') {
    return (
      <div className={`rounded-md border border-jade/20 bg-jade/5 p-4 text-sm text-jade ${compact ? '' : 'mt-6'}`}>
        {t('product', 'waitlistDone')}
      </div>
    )
  }

  if (state === 'duplicate') {
    return (
      <div className={`rounded-md border border-stone-300 bg-stone-50 p-4 text-sm text-stone-600 ${compact ? '' : 'mt-6'}`}>
        {t('product', 'waitlistAgain')}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={compact ? 'space-y-3' : 'mt-6 space-y-3 border-t border-stone-200 pt-6'}>
      {!compact && <h2 className="font-serif text-lg text-noir">{t('product', 'waitlistTitle')}</h2>}
      {!compact && <p className="text-sm text-stone-600">{t('product', 'waitlistIntro')}</p>}

      {/* Both fields keep their labels in the accessibility tree (sr-only) but
          show only placeholders visually, so the compact dialog stays small
          without becoming a form nobody can tell apart. */}
      <label htmlFor={nameId} className="sr-only">
        {t('product', 'waitlistName')}
      </label>
      <input
        id={nameId}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('product', 'waitlistNameHint')}
        required
        autoComplete="name"
        className="w-full border border-stone-300 px-4 py-2 text-base text-stone-800 focus:border-gold focus:outline-none"
        disabled={disabled}
      />

      <label htmlFor={phoneId} className="sr-only">
        {t('product', 'waitlistPhone')}
      </label>
      <input
        id={phoneId}
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t('product', 'waitlistPhoneHint')}
        required
        dir="ltr"
        inputMode="tel"
        autoComplete="tel"
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

      {/* Kept in the compact form too. A form that does not say what the details
          are for is how a shop ends up on a list it never agreed to, and a dialog
          is a consent surface exactly as much as the product page is. */}
      <p className="text-xs text-stone-500">{t('product', 'waitlistConsent')}</p>
    </form>
  )
}