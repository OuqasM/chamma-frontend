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

const ICON_PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  products: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  categories: (
    <>
      <path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </>
  ),
  brands: <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3Z" />,
  orders: (
    <>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M15 2v5h5" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  waitlist: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
    </>
  ),
  visits: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l3-4 3 3 5-7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.26 19.7l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 14.05H4.5a2 2 0 0 1 0-4h.1A1.65 1.65 0 0 0 6.2 8.3l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11.8 4.3h.1a2 2 0 0 1 4 0v.1a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
}

function NavIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

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
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-ivory/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/chamma-store-logo.png"
              alt="Chamma"
              width="36"
              height="36"
              className="h-9 w-9 shrink-0 object-contain"
            />
            <div className="leading-tight">
              <p className="font-serif text-sm font-semibold uppercase tracking-[0.18em] text-noir">Chamma</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400">{t('admin', 'title')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              aria-label={t('admin', 'locale')}
              className="min-h-11 rounded-xl border border-stone-200 bg-ivory px-2.5 text-sm text-noir outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/15"
            >
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {dictionaries[code].localeName}
                </option>
              ))}
            </select>

            <a
              href={`/${locale}/products`}
              className="hidden min-h-11 items-center rounded-xl border border-stone-200 px-3.5 text-sm font-medium text-noir transition hover:border-stone-300 hover:bg-stone-50 sm:inline-flex"
            >
              {t('admin', 'viewStore')}
            </a>

            <div className="hidden items-center gap-2 md:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold uppercase text-plum">
                {(user?.name || '?').charAt(0)}
              </span>
              <span className="text-sm text-stone-500">{user?.name}</span>
            </div>

            <button
              type="button"
              onClick={logout}
              className="min-h-11 rounded-xl border border-stone-200 px-3.5 text-sm font-medium text-noir transition hover:border-stone-300 hover:bg-stone-50"
            >
              {t('admin', 'logout')}
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-7xl overflow-x-auto px-4 pb-2 sm:px-6">
          <ul className="flex gap-1.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={`/${locale}/admin/${item.to}`}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-noir text-white shadow-sm'
                        : 'text-stone-500 hover:bg-stone-100 hover:text-noir'
                    }`
                  }
                >
                  <NavIcon name={item.key} />
                  {t('admin', item.key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
