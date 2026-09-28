export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-stone-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-gold" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function ErrorState({ message = 'Something went wrong.' }) {
  return (
    <div className="py-16 text-center">
      <p className="font-serif text-2xl text-noir">{message}</p>
    </div>
  )
}

export function EmptyState({ title, action }) {
  return (
    <div className="py-20 text-center">
      <p className="font-serif text-xl text-stone-600">{title}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
