import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

/**
 * The footer speaks the same language as the header rather than inventing a
 * second one: the serif lockup over a gold hairline, the header's small-caps
 * scale and tracking, and the mega sheet's serif heading with a rule running out
 * beside it. Link rows reuse `nav-link`, so hovering draws the same hairline
 * that grows from the inline-start edge in the header — which is the right-hand
 * edge in Arabic.
 */
export function Footer() {
  const { locale, t, nav } = useApp()

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

          <p className="max-w-sm text-sm leading-relaxed text-stone-500 sm:text-end">
            {t('footer', 'madeIn')}
          </p>
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
