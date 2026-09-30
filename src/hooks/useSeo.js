import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { resetSeo, setCanonical, setMeta, setMetaOrRemove, setRobots, setTitle, setJsonLd } from '../lib/seo'

/** The API's per-language Open Graph locale, e.g. fr_MA. */
const OG_LOCALE = { fr: 'fr_MA', ar: 'ar_MA', en: 'en_US' }

function absoluteImage(url) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  const api = import.meta.env.VITE_API_URL || ''
  return `${api.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * Applies one page's metadata.
 *
 * Every public page calls this once its data has loaded. resetSeo() runs first
 * so the previous page's tags cannot survive into this one — the common SPA
 * failure is a page rendering with the last product's description, which reads
 * as duplicate content to a crawler and looks plainly broken to a human.
 *
 * `jsonLd` is a payload, not a flag: Product passes a real schema.org object,
 * and the rest pass nothing.
 */
export default function useSeo({
  title,
  description,
  image,
  canonical,
  alternates,
  type = 'website',
  noindex = false,
  jsonLd = null,
}) {
  const { locale } = useApp()

  useEffect(() => {
    resetSeo()

    if (title) setTitle(title)

    setMetaOrRemove('description', description)
    setMetaOrRemove('og:title', title)
    setMetaOrRemove('og:description', description)
    setMetaOrRemove('og:image', absoluteImage(image))
    setMeta('og:type', type)
    setMeta('og:url', canonical ?? null)
    setMeta('og:locale', OG_LOCALE[locale] ?? 'fr_MA')
    setMeta('og:site_name', 'Chamma Store')

    setMetaOrRemove('twitter:card', image ? 'summary_large_image' : 'summary')
    setMetaOrRemove('twitter:title', title)
    setMetaOrRemove('twitter:description', description)
    setMetaOrRemove('twitter:image', absoluteImage(image))

    setCanonical({ canonical, alternates })
    setRobots(noindex ? 'noindex, nofollow' : 'index, follow')

    setJsonLd(jsonLd)
  }, [title, description, image, canonical, JSON.stringify(alternates ?? {}), type, noindex, locale, JSON.stringify(jsonLd)])
}