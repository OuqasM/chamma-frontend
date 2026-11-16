import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import useSeo from '../hooks/useSeo'

/**
 * The shop's 404 view: the route React Router matches nothing with, and —
 * since the API's 404s are rendered here too — a dead product or brand link.
 *
 * The page noindexes itself, which is the point: the bundle is served with a
 * 200 for every URL it owns, so this client-side robots meta is the only
 * "this URL does not exist" signal a crawler can pick up on those paths.
 * Anything the server can reject itself (paths outside a locale prefix, and
 * /admin) answers a real 404 before the bundle is even booted.
 */
export default function NotFound() {
  const { locale, t } = useApp()

  useSeo({ title: t('seo', 'notFoundTitle'), noindex: true })
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="font-serif text-6xl text-sand">404</p>
      <h1 className="mt-4 font-serif text-2xl text-noir">{t('notFound', 'title')}</h1>
      <p className="mt-2 text-sm text-stone-500">{t('notFound', 'body')}</p>
      <Link
        to={`/${locale}`}
        className="mt-8 inline-block bg-noir px-7 py-3 text-xs uppercase tracking-widest text-white hover:bg-gold"
      >
        {t('nav', 'home')}
      </Link>
    </div>
  )
}
