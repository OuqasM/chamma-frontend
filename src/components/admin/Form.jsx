/**
 * Admin form controls.
 *
 * Same visual language as the storefront checkout (uppercase micro labels,
 * white fields, gold focus ring) plus the per-field validation state the admin
 * API returns in `ApiError.errors`.
 */
function control(invalid, extra = '') {
  return `mt-1.5 w-full border bg-ivory px-3 py-2.5 text-base outline-none transition focus:border-gold sm:text-sm ${
    invalid ? 'border-rose-400' : 'border-stone-200'
  } ${extra}`
}

function Help({ error, hint }) {
  if (error) return <span className="mt-1 block text-[13px] text-rose-600 sm:text-xs">{error}</span>
  if (hint) return <span className="mt-1 block text-[13px] text-stone-500 sm:text-xs">{hint}</span>
  return null
}

export function Field({ label, error, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="font-semibold text-[13px] uppercase tracking-widest text-stone-400 sm:text-xs">{label}</span>}
      {children}
      <Help error={error} hint={hint} />
    </label>
  )
}

export function TextInput({ label, error, hint, className = '', textarea = false, rows = 4, ...props }) {
  const Tag = textarea ? 'textarea' : 'input'
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      <Tag rows={textarea ? rows : undefined} {...props} className={control(Boolean(error), textarea ? 'resize-y' : '')} />
    </Field>
  )
}

/**
 * Accepts either an `options` array of `{ value, label }` or `<option>`
 * children. Children win when both are given: a spread `children` is discarded
 * by JSX, so the two used to be mutually exclusive and the children form
 * silently rendered an empty select.
 */
export function Select({ label, error, hint, className = '', options, placeholder, children, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      <select {...props} className={control(Boolean(error), 'py-2')}>
        {placeholder && <option value="">{placeholder}</option>}
        {children ??
          options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
      </select>
    </Field>
  )
}

/**
 * A checkbox list rather than a `multiple` <select>.
 *
 * The shop has a handful of categories, and a list shows what is currently
 * picked at a glance instead of collapsing the whole selection into one summary
 * line. Wrapped in a <fieldset> rather than reusing <Field>, whose <label>
 * cannot legally contain a set of checkboxes.
 */
export function MultiSelect({ label, error, hint, className = '', options = [], value = [], onChange, max = 20 }) {
  const selected = value.map(Number)
  const full = selected.length >= max

  const toggle = (id, checked) => {
    onChange(checked ? [...selected, id] : selected.filter((v) => v !== id))
  }

  return (
    <fieldset className={className}>
      {label && (
        <legend className="font-semibold text-[13px] uppercase tracking-widest text-stone-400 sm:text-xs">{label}</legend>
      )}

      <div
        className={`mt-1.5 max-h-56 overflow-y-auto border bg-ivory ${
          error ? 'border-rose-400' : 'border-stone-200'
        }`}
      >
        {options.map((o) => {
          const id = Number(o.value)
          const checked = selected.includes(id)
          // Past the cap the unticked boxes go quiet rather than the form
          // silently accepting a twenty-first category.
          const disabled = !checked && full

          return (
            <label
              key={o.value}
              className={`flex items-center gap-2.5 border-b border-stone-100 px-3 py-2 last:border-b-0 ${
                disabled ? 'opacity-40' : 'cursor-pointer hover:bg-stone-50'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => toggle(id, e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              <span className="text-sm text-noir">{o.label}</span>
            </label>
          )
        })}

        {options.length === 0 && <p className="px-3 py-2.5 text-sm text-stone-400">—</p>}
      </div>

      <Help error={error} hint={hint} />
    </fieldset>
  )
}

/** Checkbox styled as a switchable row; `checked` drives the admin boolean. */
export function Toggle({ label, checked, onChange, hint, disabled = false }) {
  return (
    <label className={`flex items-start gap-3 border border-stone-200 bg-ivory px-3 py-2.5 ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-gold"
      />
      <span>
        <span className="block font-semibold text-[15px] text-noir sm:text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] text-stone-500 sm:text-xs">{hint}</span>}
      </span>
    </label>
  )
}
