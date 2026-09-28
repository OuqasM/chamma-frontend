import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAdmin } from '../context/AdminContext'
import { dictionaries, LOCALES } from '../lib/i18n'
import { Spinner } from '../components/Spinner'

const NAV = [
  { to: 'dashboard', key: 'dashboard' },
  { to: 'products', key: 'products' },
  { to: 'categories', key: 'categories' },
  { to: 'brands', key: 'brands' },
  { to: 'orders', key: 'orders' },
]

/** Gate for every authenticated admin screen; bounces to login when signed out. */
export function RequireAuth() {
  const { user, ready } = useAdmin()
  const { locale } = useApp()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <Spinner />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/${locale}/admin/login`} replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}

export function AdminLayout() {
  const { locale, setLocale, t } = useApp()
  const { user, logout } = useAdmin()

  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg text-noir">Chamma</span>
            <span className="text-[10px] uppercase tracking-widest text-stone-400">{t('admin', 'title')}</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              aria-label={t('admin', 'locale')}
              className="border border-stone-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            >
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {dictionaries[code].localeName}
                </option>
              ))}
            </select>

            <a
              href={`/${locale}/products`}
              className="hidden border border-stone-200 px-3 py-1.5 text-xs uppercase tracking-widest text-noir transition hover:border-gold hover:bg-gold hover:text-white sm:inline-block"
            >
              {t('admin', 'viewStore')}
            </a>

            <span className="hidden text-xs text-stone-500 md:inline">{user.name}</span>

            <button
              type="button"
              onClick={logout}
              className="border border-stone-200 px-3 py-1.5 text-xs uppercase tracking-widest text-noir transition hover:border-gold hover:bg-gold hover:text-white"
            >
              {t('admin', 'logout')}
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-7xl overflow-x-auto px-4">
          <ul className="flex gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={`/${locale}/admin/${item.to}`}
                  className={({ isActive }) =>
                    `block whitespace-nowrap border-b-2 px-3 py-2.5 text-xs uppercase tracking-widest transition ${
                      isActive ? 'border-gold text-noir' : 'border-transparent text-stone-500 hover:text-noir'
                    }`
                  }
                >
                  {t('admin', item.key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
