import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export function Footer() {
  const { locale, t } = useApp()

  return (
    <footer className="mt-20 border-t border-stone-200 bg-ivory">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            {/* The mark rather than the wordmark: the footer's first column is
                otherwise a single line of type, and this is the one place on the
                storefront where the shopper is not looking at the header. */}
            <Link to={`/${locale}`} className="group inline-flex items-center gap-3">
              <img
                src="/chamma-store-logo.png"
                alt="Chamma"
                width="56"
                height="56"
                loading="lazy"
                className="h-14 w-14 shrink-0 transition group-hover:opacity-80"
              />
              <span className="flex flex-col">
                <span className="font-serif text-lg tracking-[0.3em] text-noir">CHAMMA</span>
                <span aria-hidden="true" className="mt-1.5 block h-px w-full bg-gold/50" />
              </span>
            </Link>
            <p className="mt-3 text-xs text-stone-500">{t('footer', 'madeIn')}</p>
          </div>

          <div className="text-xs leading-relaxed text-stone-600">
            <p className="uppercase tracking-widest text-stone-400">{t('nav', 'categories')}</p>
            <ul className="mt-2 space-y-1">
              <li><Link className="hover:text-gold" to={`/${locale}/products`}>{t('nav', 'shop')}</Link></li>
              <li><Link className="hover:text-gold" to={`/${locale}/offers`}>{t('nav', 'offers')}</Link></li>
              <li><Link className="hover:text-gold" to={`/${locale}/order`}>{t('order', 'lookup')}</Link></li>
            </ul>
          </div>

          <p className="text-xs text-stone-400 sm:text-end">
            © {new Date().getFullYear()} Chamma Store. {t('footer', 'rights')}
          </p>
        </div>
      </div>
    </footer>
  )
}
