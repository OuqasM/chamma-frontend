import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { socialUrl } from '../lib/api'

/**
 * The footer speaks the same language as the header rather than inventing a
 * second one: the serif lockup over a gold hairline, the header's small-caps
 * scale and tracking, and the mega sheet's serif heading with a rule running out
 * beside it. Link rows reuse `nav-link`, so hovering draws the same hairline
 * that grows from the inline-start edge in the header — which is the right-hand
 * edge in Arabic.
 */
export function Footer() {
  const { locale, t, nav, contact } = useApp()

  const shop = [
    { to: `/${locale}/products`, label: t('nav', 'shop') },
    { to: `/${locale}/offers`, label: t('nav', 'offers') },
    { to: `/${locale}/products?is_new=1`, label: t('nav', 'new') },
  ]

  const account = [
    { to: `/${locale}/wishlist`, label: t('common', 'wishlist') },
    { to: `/${locale}/cart`, label: t('common', 'cart') },
    { to: `/${locale}/order`, label: t('order', 'lookup') },
  ]

  // Same two taxonomies the header's mega sheet is built from, so the footer
  // never lists a category the navigation does not have.
  const categories = (nav?.categories || []).slice(0, 6)
  const brands = (nav?.brands || []).slice(0, 6)

  // Facebook is left out on purpose: the store has no page for it, and the API
  // returns an empty string for it. The list stays explicit rather than mapping
  // over whatever the payload happens to contain, so a network added to
  // `StoreContactService` does not silently appear in the footer unreviewed.
  // Platform names are proper nouns and are deliberately not translated.
  const socials = [
    { network: 'whatsapp', label: 'WhatsApp' },
    { network: 'instagram', label: 'Instagram' },
    { network: 'tiktok', label: 'TikTok' },
  ]
    .map((s) => ({ ...s, href: socialUrl(s.network, contact?.[s.network]) }))
    .filter((s) => s.href)

  const year = new Date().getFullYear()

  return (
    <footer className="mt-20 border-t border-stone-200 bg-ivory">
      <div className="mx-auto max-w-7xl px-4 xl:px-8">
        {/* The brand tier. It sits above a full-width rule rather than beside
            the link columns, so the wordmark gets the whole measure instead of
            fighting three lists for one row. */}
        <div className="flex flex-col gap-6 border-b border-stone-200 py-12 sm:flex-row sm:items-end sm:justify-between">
          <Link to={`/${locale}`} className="group inline-flex items-center gap-4">
            <img
              src="/chamma-store-logo.png"
              alt="Chamma"
              width="64"
              height="64"
              loading="lazy"
              className="h-16 w-16 shrink-0 transition group-hover:opacity-80"
            />
            <span className="flex flex-col">
              <span className="font-serif text-2xl font-bold uppercase leading-none tracking-[0.3em] text-noir transition group-hover:text-gold">
                Chamma
              </span>
              <span aria-hidden="true" className="mt-2 block h-px w-full bg-gold/50" />
            </span>
          </Link>

          {/* The address sits above the social row on wide screens and below it
              on narrow ones. Neither is given a heading: they are one cluster of
              ways to reach the store, and four ruled columns plus a fifth headed
              one would tip the grid back into busyness. */}
          <div className="flex flex-col gap-6 sm:items-end sm:text-end">
            {contact?.address && (
              <p className="max-w-sm text-sm leading-relaxed text-stone-500">{contact.address}</p>
            )}

            {/* Only the three networks the store actually uses, and only when
                the API has a value for them: an unset env var must not leave a
                dead link to a bare host. `socialUrl` also strips the tracking
                parameters that come with a handle pasted out of a QR code. */}
            {socials.length > 0 && (
              <nav aria-label={t('footer', 'follow')}>
                <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {socials.map((s) => (
                    <li key={s.network}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nav-link inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500 transition hover:text-noir"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <p className="text-sm leading-relaxed text-stone-500">{t('footer', 'madeIn')}</p>
          </div>
        </div>

        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { heading: t('nav', 'shop'), items: shop },
            { heading: t('nav', 'categories'), items: categories.map((c) => ({ to: `/${locale}/categories/${c.slug}`, label: c.name })) },
            { heading: t('nav', 'brands'), items: brands.map((b) => ({ to: `/${locale}/brands/${b.slug}`, label: b.name })) },
            { heading: t('footer', 'account'), items: account },
          ].map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              {/* The mega sheet pairs its heading with a rule that runs to the
                  edge of the sheet. Reusing that here is most of what makes the
                  footer read as the same family as the header. */}
              <div className="flex items-baseline gap-3">
                <h2 className="font-serif text-sm font-bold uppercase tracking-[0.18em] text-noir">{col.heading}</h2>
                <span aria-hidden="true" className="h-px flex-1 bg-stone-200" />
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((it) => (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      className="nav-link inline-block text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500 transition hover:text-noir"
                    >
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-t border-stone-200 py-6 text-center text-[11px] tracking-[0.1em] text-stone-400">
          © {year} Chamma Store. {t('footer', 'rights')}
        </div>
      </div>
    </footer>
  )
}
