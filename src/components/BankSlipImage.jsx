import { useApp } from '../context/AppContext'

/**
 * The transfer slip, offered as a small download rather than a large inline
 * image: it is a tall phone screenshot, so the shopper gets the file to open in
 * their banking app instead of a wall of pixels pushing the form down the page.
 */
export default function BankSlipImage({ image, className = '' }) {
  const { t } = useApp()

  if (!image) return null

  return (
    <a
      href={image}
      download
      className={`mt-4 flex items-center gap-3 border border-stone-200 bg-ivory p-2.5 transition hover:border-gold ${className}`}
    >
      <img
        src={image}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-20 w-auto shrink-0 border border-stone-100 object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-noir">{t('checkout', 'downloadRib')}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-stone-400">{t('checkout', 'scanRib')}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-stone-400">↓</span>
    </a>
  )
}
