import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export function Footer() {
  const { locale, t } = useApp()

  return (
    <footer className="mt-20 border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-serif text-lg tracking-[0.3em] text-noir">CHAMMA</p>
            <p className="mt-2 text-xs text-stone-500">{t('footer', 'madeIn')}</p>
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
