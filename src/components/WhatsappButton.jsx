import { useApp } from '../context/AppContext'
import { socialUrl } from '../lib/api'

export default function WhatsappButton() {
  const { contact, t } = useApp()
  const href = socialUrl('whatsapp', contact?.whatsapp)

  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('common', 'whatsapp') || 'WhatsApp'}
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition hover:bg-emerald-600 md:bottom-8 md:right-8"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M12.04 2a9.93 9.93 0 0 0-8.5 15.11L2 22l4.99-1.31a9.93 9.93 0 0 0 15.02-8.53A9.93 9.93 0 0 0 12.04 2Zm0 18.2a8.16 8.16 0 0 1-4.15-1.13l-.3-.18-2.96.78.79-2.88-.2-.31a8.18 8.18 0 1 1 6.82 3.72Zm4.49-6.13c-.25-.12-1.47-.72-1.7-.8s-.4-.12-.56.12-.65.8-.8.97-.3.18-.55.06a6.74 6.74 0 0 1-1.99-1.23 7.45 7.45 0 0 1-1.38-1.72c-.14-.25 0-.38.11-.5s.25-.29.38-.44a1.66 1.66 0 0 0 .25-.42.46.46 0 0 0 0-.44c0-.12-.56-1.34-.77-1.83s-.41-.42-.56-.42h-.48a.92.92 0 0 0-.67.31 2.8 2.8 0 0 0-.87 2.08 4.89 4.89 0 0 0 1.02 2.58 11.15 11.15 0 0 0 4.26 3.77 4.89 4.89 0 0 0 2.99.63 2.55 2.55 0 0 0 1.68-1.19 2.08 2.08 0 0 0 .14-1.19c-.06-.11-.23-.18-.48-.3Z" />
      </svg>
    </a>
  )
}
