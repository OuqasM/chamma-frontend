import { useApp } from '../context/AppContext'

/**
 * The page row under a listing.
 *
 * The API's paginator arrives as a list of links — previous, the numbered
 * pages, next — and each one is a button here: the page number rides the
 * query string, so a click is a write to the listing rather than a trip to
 * another URL. A link with no URL is the gap between distant pages, and is
 * shown as plain text.
 *
 * The page number is read out of the link's own URL, which is the API's
 * (`https://api.chammastore.com/api/fr/brands/ibraq?page=2`). The storefront
 * and the API are two hosts and the URLs do not match; only the page number
 * is worth keeping.
 *
 * One page of results has nothing to page through, so the row is not drawn at
 * all: an empty row of arrows under a short list is noise, and a listing with
 * no paginator (a search that was never paginated) must not draw one either.
 */
export function Pagination({ meta, onPage }) {
  const { t } = useApp()
  const links = meta?.links ?? []
  const pages = meta?.last_page

  // Nothing to page through: a listing with no paginator at all, or one page
  // of results. The row would be a greyed-out pair of arrows around the
  // number 1, which is noise rather than a way through.
  if (!links.length) return null
  if (pages != null && pages <= 1) return null
  if (pages == null && links.length <= 2) return null

  return (
    <nav className="mt-12 flex flex-wrap justify-center gap-1.5" aria-label={t('common', 'pagination')}>
      {links.map((link, i) =>
        link.url ? (
          <button
            key={i}
            onClick={() => onPage(new URL(link.url, window.location.origin).searchParams.get('page'))}
            disabled={link.active}
            className={`min-w-9 border px-3 py-1.5 text-xs ${
              link.active ? 'border-gold bg-gold text-white' : 'border-stone-200 hover:border-gold'
            }`}
            dangerouslySetInnerHTML={{ __html: link.label }}
          />
        ) : (
          <span
            key={i}
            className="min-w-9 border border-stone-100 px-3 py-1.5 text-center text-xs text-stone-300"
            dangerouslySetInnerHTML={{ __html: link.label }}
          />
        ),
      )}
    </nav>
  )
}
