/**
 * Admin chrome: page scaffolding, tables, feedback and confirmations.
 * The storefront has no table/modal primitives, so these are the shared ones
 * every admin screen builds on.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

/**
 * The API reports an order status as a Tailwind colour *name* (amber, sky, …).
 * Those names cannot be interpolated into a class string — Tailwind only emits
 * classes it can see written out in the source — so every tone is spelled out
 * here in full.
 */
const STATUS_TONES = {
  amber: 'border-amber-200/80 bg-amber-50 text-amber-700',
  sky: 'border-sky-200/80 bg-sky-50 text-sky-700',
  emerald: 'border-emerald-200/80 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200/80 bg-rose-50 text-rose-700',
}

const BADGE_TONES = {
  neutral: 'border-stone-200 bg-stone-100 text-stone-600',
  accent: 'border-gold/25 bg-gold/10 text-plum',
  jade: 'border-jade/25 bg-jade/10 text-jade',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
}

/** A soft pill; sentence-case so status words read rather than shout. */
export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${BADGE_TONES[tone] || BADGE_TONES.neutral} ${className}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ label, color }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_TONES[color] || STATUS_TONES.indigo}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {label}
    </span>
  )
}

/**
 * The body is padded by default — previously only the header was, so every
 * caller had to remember its own padding and several did not (bare text panels
 * and filter rows ended up flush against the border). Pass `bodyClassName` to
 * override; table bodies pass an empty string to stay edge-to-edge, since
 * `Table` already pads its own cells.
 */
export function Panel({ title, actions, children, className = '', bodyClassName = 'px-6 py-5' }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-stone-200/80 bg-ivory shadow-[0_1px_2px_rgba(58,29,39,0.04),0_16px_40px_-28px_rgba(58,29,39,0.35)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-4 w-1 rounded-full bg-gold" aria-hidden="true" />
            {title && <h2 className="text-sm font-semibold text-noir">{title}</h2>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-noir sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/**
 * A single number on a soft card. Two `<p>` children on purpose: the label
 * first, the value second, which the visits dashboard test reads positionally.
 */
export function StatCard({ label, value, hint, tone = 'default' }) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-ivory px-5 py-4 shadow-[0_1px_2px_rgba(58,29,39,0.04),0_16px_40px_-30px_rgba(58,29,39,0.4)]">
      <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tracking-tight ${tone === 'accent' ? 'text-plum' : 'text-noir'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-400">{hint}</p>}
    </div>
  )
}

export function Banner({ children, tone = 'error' }) {
  if (!children) return null
  const tones = {
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-jade/25 bg-jade/10 text-jade',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    info: 'border-stone-200 bg-stone-50 text-noir',
  }
  return (
    <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${tones[tone] || tones.error}`}>
      {children}
    </div>
  )
}

const PRIMARY_BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-noir px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40'
const GHOST_TONES = {
  default: 'border border-stone-200 bg-ivory text-noir hover:border-stone-300 hover:bg-stone-50',
  danger: 'border border-rose-200 bg-ivory text-rose-700 hover:border-rose-600 hover:bg-rose-600 hover:text-white',
}

/**
 * Same look as the buttons above, for a react-router <Link>. A button nested in
 * an anchor is invalid HTML and breaks keyboard activation, so navigation has
 * to carry the styling instead of wrapping it.
 */
export function buttonClass(variant = 'primary', tone = 'default') {
  return variant === 'primary'
    ? PRIMARY_BUTTON_CLASS
    : `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${GHOST_TONES[tone] || GHOST_TONES.default}`
}

export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`${PRIMARY_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, className = '', tone = 'default', ...props }) {
  return (
    <button
      {...props}
      className={`${buttonClass('ghost', tone)} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/40 p-4 backdrop-blur-sm sm:p-8">
      <div
        className={`w-full overflow-hidden rounded-2xl border border-stone-200/80 bg-ivory shadow-2xl shadow-stone-950/20 ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4">
          <h2 className="text-base font-semibold text-noir">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-noir"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-4">{footer}</footer>}
      </div>
    </div>
  )
}

/**
 * Two-step destructive action: the first click arms it, the second confirms.
 * Keeps `window.confirm` out of the panel without needing a modal per row.
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled = false, tone = 'danger' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <ConfirmButtonInner label={label} confirmLabel={confirmLabel} onConfirm={onConfirm} disabled={disabled} tone={tone} />
    </span>
  )
}

function ConfirmButtonInner({ label, confirmLabel, onConfirm, disabled, tone }) {
  return (
    <GhostButton
      tone={tone}
      disabled={disabled}
      onClick={(e) => {
        const btn = e.currentTarget
        if (btn.dataset.armed === '1') {
          delete btn.dataset.armed
          btn.textContent = label
          onConfirm()
          return
        }
        btn.dataset.armed = '1'
        btn.textContent = confirmLabel
        // Disarms itself so a stray later click cannot delete twice.
        setTimeout(() => {
          if (btn.dataset.armed === '1') {
            delete btn.dataset.armed
            btn.textContent = label
          }
        }, 4000)
      }}
    >
      {label}
    </GhostButton>
  )
}

/**
 * The secondary actions of a table row, behind one trigger.
 *
 * A row had grown to four 44px buttons, which is a wall of borders and gets
 * worse with every action added. Only the primary action stays in the cell.
 *
 * The menu is rendered in a portal at a fixed position rather than absolutely
 * inside the cell: `Table` scrolls horizontally, and an overflow container
 * clips its children, so a dropdown anchored in the cell would be cut off and
 * force the table to scroll to reach it. Position is measured from the trigger
 * instead.
 *
 * Items are `{ key, label, onClick | to, tone, confirmLabel }`. A `confirmLabel`
 * arms the item on the first click and runs it on the second, which is how
 * `ConfirmButton` keeps a destructive action two clicks deep without a modal.
 */
export function ActionMenu({ label, items = [] }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)
  const [placement, setPlacement] = useState({ top: 0, left: 0 })
  const [armedKey, setArmedKey] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const itemRefs = useRef([])

  // Measured before paint so the menu never appears at the wrong spot first.
  // The height is read on a second pass because the menu is not in the DOM yet
  // on the first one, and it is what decides whether there is room below.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setAnchor(r)

    const raf = requestAnimationFrame(() => {
      const h = menuRef.current?.offsetHeight ?? 0
      const gap = 6
      const fitsBelow = window.innerHeight - r.bottom - gap >= h
      setPlacement({
        top: fitsBelow ? r.bottom + gap : Math.max(gap, r.top - gap - h),
        left: Math.max(8, Math.min(r.right - 208, window.innerWidth - 208 - 8)),
      })
    })

    return () => cancelAnimationFrame(raf)
  }, [open])

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    setArmedKey(null)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return

      // A menu is expected to move between its items with the arrow keys;
      // letting Tab do it instead strands the user once the last item is past.
      e.preventDefault()
      const count = items.length
      if (!count) return
      const at = itemRefs.current.indexOf(document.activeElement)
      const step = e.key === 'ArrowDown' ? 1 : -1
      const next = at === -1 ? 0 : (at + step + count) % count
      itemRefs.current[next]?.focus()
    }

    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return
      close(false)
    }

    // Re-measuring on every scroll frame would make the menu chase the row;
    // closing is the predictable behaviour and is what the other admin
    // overlays do.
    const dismiss = () => close(false)

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open, items.length, close])

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus()
  }, [open])

  const runItem = (item) => {
    // A destructive item is armed first, then run on the second click.
    if (item.confirmLabel && armedKey !== item.key) {
      setArmedKey(item.key)
      // Disarms itself so a stray later click cannot delete twice.
      setTimeout(() => setArmedKey((k) => (k === item.key ? null : k)), 4000)
      return
    }

    setOpen(false)
    setArmedKey(null)
    item.onClick?.()
  }

  // Flipped above the trigger when there is not enough room below, and inset
  // from the right edge so it cannot run off screen on a narrow table.
  const style = anchor ? placement : undefined

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex min-h-11 w-11 items-center justify-center rounded-xl border border-stone-200 text-noir transition hover:border-stone-300 hover:bg-stone-50"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>

      {open &&
        style &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={style}
            className="fixed z-50 w-52 rounded-xl border border-stone-200/80 bg-ivory p-1.5 shadow-xl shadow-stone-950/10"
          >
            {items.map((item, index) => {
              const armed = armedKey === item.key
              const content = armed && item.confirmLabel ? item.confirmLabel : item.label
              const tone = item.tone === 'danger' ? 'text-rose-700 hover:bg-rose-50' : 'text-noir hover:bg-stone-100'
              const className = `flex w-full items-center rounded-lg px-3 py-2.5 text-start text-[13px] font-medium transition ${tone} ${
                armed ? 'bg-rose-50' : ''
              }`
              const ref = (el) => {
                itemRefs.current[index] = el
              }

              // An item either navigates or acts; only navigation needs a Link,
              // and rendering a button as a Link would need a `to` it has no
              // meaning for.
              return item.to ? (
                <Link key={item.key} to={item.to} role="menuitem" ref={ref} onClick={() => runItem(item)} className={className}>
                  {content}
                </Link>
              ) : (
                <button key={item.key} type="button" role="menuitem" ref={ref} onClick={() => runItem(item)} className={className}>
                  {content}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}

export function Table({ head, children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[40rem] border-collapse text-start">
        <thead>
          <tr className="border-b border-stone-200">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className={`px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 ${h === '' ? 'w-px' : 'text-start'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className = '' }) {
  return <td className={`px-5 py-3.5 align-middle text-sm text-noir ${className}`}>{children}</td>
}

/** Paginator driven by Laravel's `meta.links`, so any admin list can use it. */
export function Pagination({ meta, onPage }) {
  const links = meta?.links
  if (!links || links.length <= 2) return null

  return (
    <nav className="flex flex-wrap justify-center gap-1.5" aria-label="Pagination">
      {links.map((link, i) =>
        link.url ? (
          <button
            key={i}
            type="button"
            onClick={() => onPage(new URL(link.url, window.location.origin).searchParams.get('page'))}
            disabled={link.active}
            className={`min-h-11 min-w-11 rounded-lg border px-3 py-2 text-sm transition ${
              link.active ? 'border-noir bg-noir text-white' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
            }`}
            dangerouslySetInnerHTML={{ __html: link.label }}
          />
        ) : (
          <span
            key={i}
            className="min-h-11 min-w-11 rounded-lg border border-stone-100 px-3 py-2 text-center text-sm text-stone-300"
            dangerouslySetInnerHTML={{ __html: link.label }}
          />
        ),
      )}
    </nav>
  )
}
