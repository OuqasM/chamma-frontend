/**
 * Multi-select variant picker for the product page.
 *
 * A product can be sold in several sizes and a shopper often wants more than
 * one at once, so this is a multi-select rather than the single-choice select
 * it replaces. The native `<select multiple>` is ruled out: it needs a modifier
 * key to choose a second option, shows no clear "you may pick several" affordance
 * and one false click drops the whole selection.
 *
 * So it is a small popover: a trigger that summarises the choice, a list of
 * options that toggle independently, and the same dismissal rules every other
 * overlay in the shop uses (`useDismiss` for outside presses and Escape,
 * `useOverlayTransition` so it fades out instead of blinking away).
 *
 * Keyboard follows the combobox the checkout's city field uses: the trigger
 * keeps focus, arrows move a highlighted row, Enter or Space toggles it. The
 * panel stays open on every toggle — that is the whole point of choosing more
 * than one.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useDismiss, useOverlayTransition, DROPDOWN_MS } from '../lib/overlay'

export default function VariantPicker({ variants = [], value = [], onChange, describedBy }) {
  const { t } = useApp()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)
  const generatedId = useId()
  const listId = `${generatedId}-list`

  const refs = useRef([])
  refs.current = [wrapperRef]
  useDismiss(refs, open, setOpen)

  const { mounted, shown } = useOverlayTransition(open, DROPDOWN_MS)

  // Start the highlight on the first chosen row so opening onto a selection does
  // not point at an unrelated option.
  useEffect(() => {
    if (!open) return
    const first = variants.findIndex((v) => value.includes(v.name))
    setActive(first >= 0 ? first : 0)
    // Deliberately keyed on `open` alone: `value` changes on every toggle and
    // re-running this would yank the highlight back mid-selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggle = (name) =>
    onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name])

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, variants.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      // preventDefault so a Space does not scroll the page or a stray Enter in
      // an enclosing form submits it.
      e.preventDefault()
      const variant = variants[active]
      if (variant) toggle(variant.name)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-describedby={describedBy}
        className={`flex w-full items-center justify-between gap-2 border bg-ivory px-3 py-2.5 text-start text-sm outline-none transition ${
          open ? 'border-gold ring-1 ring-gold/20' : 'border-stone-200 hover:border-stone-300 focus:border-gold'
        }`}
      >
        {value.length === 0 ? (
          <span className="truncate text-stone-400">{t('product', 'selectVariants') || 'Select variants'}</span>
        ) : (
          <span className="truncate text-noir">{value.join(', ')}</span>
        )}

        <span className="flex shrink-0 items-center gap-2">
          {value.length > 0 && (
            <span className="rounded-full bg-gold px-1.5 py-0.5 text-[11px] font-medium leading-none text-white">
              {value.length}
            </span>
          )}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`h-4 w-4 text-stone-400 transition ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {/* Kept mounted for the length of its exit fade; `shown` drives the
          `.dropdown` transition, and pointer events are cut while it is
          invisible so a ghost panel cannot swallow a click. */}
      {mounted && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          data-open={shown}
          className={`dropdown absolute z-30 mt-1 w-full rounded-xl border border-stone-200 bg-ivory shadow-xl ${
            shown ? '' : 'pointer-events-none'
          }`}
        >
          {variants.map((v, i) => {
            const selected = value.includes(v.name)
            return (
              <button
                key={v.id || v.name}
                type="button"
                role="option"
                aria-selected={selected}
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => toggle(v.name)}
                className={`flex w-full items-center justify-between gap-3 border-b border-stone-100 px-3.5 py-2.5 text-start text-sm transition last:border-b-0 ${
                  i === active ? 'bg-sand' : ''
                } ${selected ? 'text-noir' : 'text-stone-700'}`}
              >
                <span className="truncate">{v.name}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`h-4 w-4 shrink-0 text-gold transition ${selected ? 'opacity-100' : 'opacity-0'}`}
                  aria-hidden="true"
                >
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
