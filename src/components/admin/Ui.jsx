/**
 * Admin chrome: page scaffolding, tables, feedback and confirmations.
 * The storefront has no table/modal primitives, so these are the shared ones
 * every admin screen builds on.
 */

/**
 * The API reports an order status as a Tailwind colour *name* (amber, sky, …).
 * Those names cannot be interpolated into a class string — Tailwind only emits
 * classes it can see written out in the source — so every tone is spelled out
 * here in full.
 */
const STATUS_TONES = {
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  sky: 'border-sky-200 bg-sky-50 text-sky-800',
  violet: 'border-violet-200 bg-violet-50 text-violet-800',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-800',
}

const BADGE_TONES = {
  neutral: 'border-stone-200 bg-stone-50 text-stone-600',
  accent: 'border-gold/30 bg-sand text-noir',
  jade: 'border-jade/30 bg-jade/10 text-jade',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span className={`inline-block border px-2 py-0.5 text-[11px] uppercase tracking-widest sm:text-xs ${BADGE_TONES[tone] || BADGE_TONES.neutral} ${className}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ label, color }) {
  return (
    <span className={`inline-block border px-2 py-0.5 text-[11px] uppercase tracking-widest sm:text-xs ${STATUS_TONES[color] || STATUS_TONES.indigo}`}>
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
export function Panel({ title, actions, children, className = '', bodyClassName = 'px-5 py-4' }) {
  return (
    <section className={`border border-stone-200 bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-3.5">
          {title && <h2 className="text-[13px] uppercase tracking-widest text-stone-500 sm:text-xs">{title}</h2>}
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
        <h1 className="text-2xl font-semibold text-noir sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Banner({ children, tone = 'error' }) {
  if (!children) return null
  const tones = {
    error: 'border-rose-300 bg-rose-50 text-rose-800',
    success: 'border-jade/30 bg-jade/10 text-jade',
    info: 'border-stone-200 bg-sand/60 text-noir',
  }
  return (
    <div role="alert" className={`border px-4 py-3 text-sm ${tones[tone] || tones.error}`}>
      {children}
    </div>
  )
}

const PRIMARY_BUTTON_CLASS =
  'min-h-11 bg-noir px-5 py-2.5 text-[13px] uppercase tracking-widest text-white transition hover:bg-gold sm:text-xs'
const GHOST_TONES = {
  default: 'border-stone-200 text-noir hover:border-gold hover:bg-gold hover:text-white',
  danger: 'border-rose-300 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600',
}

/**
 * Same look as the buttons above, for a react-router <Link>. A button nested in
 * an anchor is invalid HTML and breaks keyboard activation, so navigation has
 * to carry the styling instead of wrapping it.
 */
export function buttonClass(variant = 'primary', tone = 'default') {
  return variant === 'primary'
    ? PRIMARY_BUTTON_CLASS
    : `min-h-11 border px-4 py-2 text-[13px] uppercase tracking-widest transition sm:text-xs ${GHOST_TONES[tone] || GHOST_TONES.default}`
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/50 p-4 sm:p-8">
      <div
        className={`w-full border border-stone-200 bg-ivory shadow-lg ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-3.5">
          <h2 className="text-[13px] uppercase tracking-widest text-stone-500 sm:text-xs">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-stone-400 transition hover:text-noir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-stone-200 px-5 py-3.5">{footer}</footer>}
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

export function Table({ head, children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[40rem] border-collapse text-start">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className={`px-4 py-3 text-[11px] uppercase tracking-widest text-stone-500 sm:py-2.5 sm:text-xs ${h === '' ? 'w-px' : 'text-start'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 align-middle text-[15px] text-noir sm:text-sm ${className}`}>{children}</td>
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
            className={`min-h-11 min-w-11 border px-3 py-2 text-sm ${
              link.active ? 'border-gold bg-gold text-white' : 'border-stone-200 hover:border-gold'
            }`}
            dangerouslySetInnerHTML={{ __html: link.label }}
          />
        ) : (
          <span
            key={i}
            className="min-h-11 min-w-11 border border-stone-100 px-3 py-2 text-center text-sm text-stone-300"
            dangerouslySetInnerHTML={{ __html: link.label }}
          />
        ),
      )}
    </nav>
  )
}
