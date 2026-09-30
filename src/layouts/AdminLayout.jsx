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
  { to: 'waitlist', key: 'waitlist' },
  { to: 'visits', key: 'visits' },
  { to: 'settings', key: 'settings' },
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
      <header className="border-b border-stone-200 bg-ivory">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold tracking-wide text-noir sm:text-lg">Chamma</span>
            <span className="text-[11px] uppercase tracking-widest text-stone-400 sm:text-xs">{t('admin', 'title')}</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              aria-label={t('admin', 'locale')}
              className="min-h-11 border border-stone-200 bg-ivory px-2 text-sm outline-none focus:border-gold"
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

            <span className="hidden text-sm text-stone-500 md:inline">{user.name}</span>

            <button
              type="button"
              onClick={logout}
              className="min-h-11 border border-stone-200 px-3 text-[13px] uppercase tracking-widest text-noir transition hover:border-gold hover:bg-gold hover:text-white sm:text-xs"
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
                    `block whitespace-nowrap border-b-2 px-3 py-3 text-[13px] uppercase tracking-widest transition sm:py-2.5 sm:text-xs ${
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
