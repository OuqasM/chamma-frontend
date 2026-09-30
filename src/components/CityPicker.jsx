/**
 * City picker for the checkout form.
 *
 * The carrier's table has 444 destinations, which rules out a native
 * `<select>`: it renders an unsearchable scroll list, cannot show what each city
 * costs to deliver to, and on mobile it opens a full-screen picker that scrolls
 * badly. This is a combobox instead: type to filter, arrow keys to move, Enter
 * to choose, Escape to dismiss.
 *
 * Two details that are easy to get wrong and are handled here explicitly:
 *
 * - **Diacritics.** The table mixes spellings — `Fes`, `Fès`, `MEKNES`,
 *   `Meknès`, `AGELMOUS`. Typing `fes` has to find Fès, or the shopper concludes
 *   the store does not deliver to their city. Matching ignores case and
 *   combining marks, so `fes`, `Fès` and `FES` all match.
 * - **Cost and delay are shown before choosing.** The point of asking the user to
 *   pick a city is that delivery costs money, and the fee is already known from
 *   the API. Hiding it until after selection means picking the wrong city first.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatPrice } from '../lib/format'

/** Strips case and combining accents: `Fès` -> `fes`, `Meknès` -> `meknes`. */
function normalise(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Matches on the city name. Fee and delay are deliberately not searchable: a
 * shopper looking for Ouarzazate is searching for a place, not a price.
 */
function matches(city, query) {
  if (!query) return true
  const q = normalise(query)
  return normalise(city.label).includes(q) || normalise(city.value).includes(q)
}

export default function CityPicker({ cities, value, onChange, locale, t, invalid, id, describedBy }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const generatedId = useId()

  const inputId = id || generatedId
  const listId = `${inputId}-list`

  const selected = useMemo(
    () => cities.find((c) => c.value === value) || null,
    [cities, value],
  )

  // The list is computed once per keystroke, not per render of the 444 rows.
  const matches_ = useMemo(() => cities.filter((c) => matches(c, query)), [cities, query])

  // Reset the highlighted row whenever the filtered set changes, or Enter picks
  // a row from the previous filter that is no longer on screen.
  useEffect(() => {
    setActive(0)
  }, [query])

  // Clicking anywhere else closes the list. `pointerdown` rather than `click` so
  // the outside click does not also land on whatever is underneath.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Escape closes without selecting, which is what a dismissed dialog should do.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Keep the highlighted row in view when arrowing through a long list.
  useEffect(() => {
    if (!open || !listRef.current) return
    listRef.current.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const choose = (city) => {
    onChange(city.value)
    setOpen(false)
    setQuery('')
    inputRef.current?.focus()
  }

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, matches_.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // preventDefault, or the enclosing <form> submits before the choice lands.
      e.preventDefault()
      const city = matches_[active]
      if (city) choose(city)
    }
  }

  const baseClass =
    'mt-1.5 w-full border bg-ivory px-3 py-2.5 text-sm outline-none transition focus:border-gold'
  const borderClass = invalid ? 'border-rose-400' : 'border-stone-200'

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor={inputId} className="font-semibold text-xs uppercase tracking-widest text-stone-400">
        {t('checkout', 'city')}
      </label>

      {/* The read-only display of the current choice. It is not the input: a
          controlled <input> holding "Casablanca" would filter on every keystroke
          and immediately hide the rest of the list. */}
      <button
        type="button"
        id={inputId}
        ref={inputRef}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${baseClass} ${borderClass} flex items-center justify-between gap-2 text-start ${
          selected ? 'text-noir' : 'text-stone-400'
        }`}
      >
        <span className="truncate">{selected ? selected.label : t('checkout', 'cityPlaceholder')}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {selected && (
        <p className="mt-1 text-xs text-stone-500">
          {selected.fee > 0
            ? `${t('checkout', 'deliveryFee')}: ${formatPrice(selected.fee, locale)}`
            : t('checkout', 'freeDelivery')}
          {selected.delay ? ` · ${selected.delay}` : ''}
        </p>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full border border-stone-200 bg-ivory shadow-lg">
          <div className="border-b border-stone-200 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t('checkout', 'citySearch')}
              aria-label={t('checkout', 'citySearch')}
              aria-autocomplete="list"
              aria-controls={listId}
              autoComplete="off"
              className="w-full border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>

          {matches_.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-stone-500">{t('checkout', 'cityNoResult')}</p>
          ) : (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={t('checkout', 'city')}
              className="max-h-64 overflow-y-auto"
            >
              {matches_.map((city, i) => (
                <li key={city.value} role="option" aria-selected={city.value === value}>
                  <button
                    type="button"
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(city)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start text-sm transition ${
                      i === active ? 'bg-sand' : ''
                    } ${city.value === value ? 'text-noir' : 'text-stone-700'}`}
                  >
                    <span className="truncate">{city.label}</span>
                    <span className="shrink-0 text-xs text-stone-400">
                      {city.fee > 0 ? formatPrice(city.fee, locale) : t('common', 'free')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}