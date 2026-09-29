import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { LOCALES, dictionaries } from '../lib/i18n'

function useDismiss(refs, open, setOpen) {
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      const inside = refs.some((r) => r.current && r.current.contains(e.target))
      if (!inside) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, refs, setOpen])
}

function LocaleSwitcher() {
  const { locale, setLocale } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const refs = useRef([])
  refs.current = [ref]
  useDismiss(refs, open, setOpen)
  const mounted = useExitTransition(open, DROPDOWN_MS)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs uppercase tracking-widest text-noir"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {locale}
        <span aria-hidden="true" className="text-[10px]">▾</span>
      </button>

      {mounted && (
        <ul
          role="listbox"
          data-open={open}
          className="dropdown absolute end-0 z-50 mt-2 w-36 border border-stone-200 bg-white py-1 shadow-lg"
        >
          {LOCALES.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === locale}
                onClick={() => {
                  setLocale(code)
                  setOpen(false)
                }}
                className={`block w-full px-3 py-1.5 text-start text-xs hover:bg-ivory ${
                  code === locale ? 'font-semibold text-gold' : 'text-noir'
                }`}
              >
                {dictionaries[code].localeName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NavMenu({ label, items, active, to }) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const refs = useRef([])
  refs.current = [triggerRef, menuRef]
  useDismiss(refs, open, setOpen)
  const mounted = useExitTransition(open, DROPDOWN_MS)

  useEffect(() => {
    setOpen(false)
  }, [to, items])

  // The nav is a horizontal scroll container, so an in-flow dropdown would be
  // clipped by it. Render into <body> and place it against the trigger instead.
  // Placement follows `mounted` rather than `open`, so the box is still measured
  // and anchored while it fades out.
  useLayoutEffect(() => {
    if (!mounted) {
      setStyle(null)
      return
    }

    const place = () => {
      const trigger = triggerRef.current
      const menu = menuRef.current
      if (!trigger || !menu) return

      const r = trigger.getBoundingClientRect()
      const h = menu.offsetHeight
      const w = menu.offsetWidth
      const gap = 8
      const fitsBelow = window.innerHeight - r.bottom - gap >= h
      const top = fitsBelow ? r.bottom + gap : Math.max(gap, r.top - gap - h)
      const rtl = document.documentElement.dir === 'rtl'
      // The trigger can sit at either end of the horizontally scrolling nav, so
      // clamp the menu to stay fully on screen.
      const clamp = (v) => Math.min(Math.max(gap, v), Math.max(gap, window.innerWidth - w - gap))

      setStyle({
        top,
        minWidth: Math.max(r.width, 200),
        ...(rtl ? { right: clamp(window.innerWidth - r.right) } : { left: clamp(r.left) }),
        visibility: 'visible',
      })
    }

    place()
    // The menu is measured before its min-width is applied, so re-place once
    // the final box is known.
    const raf = requestAnimationFrame(place)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [mounted, items.length])

  // The box is measured with the closed opacity still applied, so flipping to
  // the open state has to wait a frame or there is nothing to transition from.
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!mounted) {
      setShown(false)
      return
    }
    const raf = requestAnimationFrame(() => setShown(open))
    return () => cancelAnimationFrame(raf)
  }, [mounted, open])

  if (!items.length) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`block whitespace-nowrap border-b pb-1 uppercase transition ${
          active || open
            ? 'border-gold text-gold'
            : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-noir'
        }`}
      >
        {label}
        <span aria-hidden="true" className="ms-1 text-[9px] align-middle">▾</span>
      </button>

      {mounted &&
        createPortal(
          <ul
            ref={menuRef}
            data-open={shown}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              visibility: 'hidden',
              ...(style || {}),
            }}
            className="dropdown z-50 mt-0 min-w-[200px] border border-stone-200 bg-white py-1 text-xs font-normal normal-case shadow-lg"
          >
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className="block whitespace-nowrap px-3 py-2 text-xs normal-case text-noir transition hover:bg-ivory"
                >
                  <span>{it.name}</span>
                </Link>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  )
}

function HeaderMenus() {
  const { locale, t, nav } = useApp()
  const location = useLocation()

  const brandItems = (nav?.brands || []).map((b) => ({
    id: b.id,
    name: b.name,
    to: `/${locale}/brands/${b.slug}`,
  }))

  const categoryItems = (nav?.categories || []).map((c) => ({
    id: c.id,
    name: c.name,
    to: `/${locale}/categories/${c.slug}`,
  }))

  return (
    <>
      <NavMenu
        label={t('nav', 'brands')}
        items={brandItems}
        to={location.pathname}
        active={location.pathname.startsWith(`/${locale}/brands/`)}
      />
      <NavMenu
        label={t('nav', 'categories')}
        items={categoryItems}
        to={location.pathname}
        active={location.pathname.startsWith(`/${locale}/categories/`)}
      />
    </>
  )
}

/**
 * The same two menus, folded into the drawer on small screens: a portal
 * dropdown would be clipped by the panel, so they collapse in place instead.
 */
function DrawerSection({ label, items }) {
  const [open, setOpen] = useState(false)

  if (!items.length) return null

  return (
    <div className="border-b border-stone-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-3 text-start text-xs uppercase tracking-widest text-stone-600"
      >
        {label}
        <span aria-hidden="true" className={`text-[9px] transition ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* Animating the row height keeps the links below it from jumping. */}
      <div
        className={`accordion grid ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        aria-hidden={!open}
      >
        <ul className="overflow-hidden space-y-2 pb-3 pe-2 text-sm normal-case text-stone-600">
          {items.map((it) => (
            <li key={it.id}>
              <Link to={it.to} tabIndex={open ? undefined : -1} className="block py-0.5 hover:text-gold">
                {it.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Matches the `transition` duration of `.drawer` in index.css.
const DRAWER_MS = 300
// Matches the `transition` duration of `.dropdown` in index.css.
const DROPDOWN_MS = 180

/**
 * Keeps a panel or menu mounted for the length of its exit transition.
 * Unmounting the instant `open` flips to false leaves no frame to animate,
 * which is why these menus used to snap in and out instead of easing.
 */
function useExitTransition(open, ms) {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    if (!mounted) return
    const timer = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(timer)
  }, [open, mounted, ms])

  return mounted
}

function MobileMenu({ open, onClose, links, brandItems, categoryItems, isNewRoute }) {
  const { t, locale, cartCount, wishlist } = useApp()
  const location = useLocation()
  const panelRef = useRef(null)
  const refs = useRef([])
  refs.current = [panelRef]
  useDismiss(refs, open, onClose)

  // The page behind the drawer must not scroll under the shopper's finger.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // The panel stays mounted for the length of the exit transition, so it can
  // finish sliding out instead of vanishing.
  const mounted = useExitTransition(open, DRAWER_MS)

  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  if (!mounted) return null

  // Portalled to <body>: the header carries `backdrop-blur`, and a filtered
  // ancestor becomes the containing block for `position: fixed`, which would
  // size the panel to the header strip instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 xl:hidden">
      <button
        type="button"
        aria-label={t('common', 'close')}
        onClick={onClose}
        style={{ opacity: open ? 1 : 0 }}
        className="drawer-backdrop absolute inset-0 bg-noir/40"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('common', 'menu')}
        data-open={open}
        className="drawer absolute inset-y-0 start-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto bg-ivory shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <span className="text-xs uppercase tracking-[0.3em] text-noir">{t('common', 'menu')}</span>
          {/* The language list drops below the trigger, so it lives up here
              rather than at the foot of the panel, where the scroll area would
              clip it. */}
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common', 'close')}
              className="text-lg leading-none text-stone-500 hover:text-gold"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <SearchBar onNavigate={onClose} />
        </div>

        <nav className="flex flex-col border-t border-stone-200 px-5 text-xs uppercase tracking-widest">
          {links.map((l) => (
            <NavLink
              key={l.key}
              to={l.to}
              end={l.end}
              onClick={onClose}
              className={({ isActive }) =>
                `border-b border-stone-200 py-3 transition ${
                  isActive && linkIsActive(l.key, isActive, isNewRoute) ? 'text-gold' : 'text-stone-600'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}

          <DrawerSection label={t('nav', 'brands')} items={brandItems} />
          <DrawerSection label={t('nav', 'categories')} items={categoryItems} />
        </nav>

        <div className="mt-auto border-t border-stone-200 px-5 py-4 text-xs uppercase tracking-widest">
          <div className="flex items-center justify-between">
            <Link to={`/${locale}/wishlist`} onClick={onClose} className="text-stone-600 hover:text-gold">
              {t('common', 'wishlist')}
              {wishlist.length > 0 && <span className="ms-1 text-gold">{wishlist.length}</span>}
            </Link>
            <Link to={`/${locale}/cart`} onClick={onClose} className="text-stone-600 hover:text-gold">
              {t('common', 'cart')}
              {cartCount > 0 && <span className="ms-1 text-gold">{cartCount}</span>}
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SearchBar({ onNavigate }) {
  const { locale, t } = useApp()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) {
          navigate(`/${locale}/search?q=${encodeURIComponent(q.trim())}`)
          onNavigate?.()
        }
      }}
      className="relative"
      role="search"
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('nav', 'search')}
        aria-label={t('nav', 'search')}
        className="w-32 border-b border-noir/20 bg-transparent py-1 text-xs outline-none transition focus:w-44 focus:border-gold md:w-44 md:focus:w-56"
      />
    </form>
  )
}

/** "Shop" and "New arrivals" share a path, so the query decides which is lit. */
function linkIsActive(key, matched, isNewRoute) {
  if (key === 'shop') return matched && !isNewRoute
  if (key === 'new') return isNewRoute
  return matched
}

export function Header() {
  const { locale, t, nav, cartCount, wishlist } = useApp()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isNewRoute =
    location.pathname === `/${locale}/products` &&
    new URLSearchParams(location.search).get('is_new') === '1'

  const links = [
    { key: 'home', to: `/${locale}`, label: t('nav', 'home'), end: true },
    { key: 'shop', to: `/${locale}/products`, label: t('nav', 'shop') },
    { key: 'offers', to: `/${locale}/offers`, label: t('nav', 'offers') },
    { key: 'new', to: `/${locale}/products?is_new=1`, label: t('nav', 'new') },
  ]

  const brandItems = (nav?.brands || []).map((b) => ({
    id: b.id,
    name: b.name,
    to: `/${locale}/brands/${b.slug}`,
  }))

  const categoryItems = (nav?.categories || []).map((c) => ({
    id: c.id,
    name: c.name,
    to: `/${locale}/categories/${c.slug}`,
  }))

  // The drawer is a small-screen affordance: a resize up to the desktop
  // layout must not leave it stranded over the header.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const close = () => mq.matches && setMenuOpen(false)
    mq.addEventListener('change', close)
    return () => mq.removeEventListener('change', close)
  }, [])

  const linkClass = (active) =>
    `whitespace-nowrap pb-1 transition ${
      active ? 'border-b border-gold text-gold' : 'text-stone-600 hover:text-noir'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-ivory/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center gap-x-5 gap-y-2 py-3 xl:gap-x-7">
          <Link to={`/${locale}`} aria-label="Chamma Store" className="flex shrink-0 items-center">
            <img
              src="/chamma-store-logo.png"
              alt="Chamma Store"
              className="h-11 w-auto"
              width="44"
              height="44"
            />
          </Link>

          <nav
            className="hidden min-w-0 flex-1 items-center gap-5 overflow-x-auto text-xs uppercase tracking-widest xl:flex"
            aria-label="Main"
          >
            {links.map((l) => (
              <NavLink
                key={l.key}
                to={l.to}
                end={l.end}
                className={({ isActive }) => linkClass(linkIsActive(l.key, isActive, isNewRoute))}
              >
                {l.label}
              </NavLink>
            ))}

            <HeaderMenus />
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-4 xl:ms-0">
            <div className="hidden sm:block">
              <SearchBar />
            </div>
            <div className="hidden sm:block">
              <LocaleSwitcher />
            </div>
            <Link
              to={`/${locale}/wishlist`}
              className="relative hidden text-xs uppercase tracking-widest text-noir hover:text-gold sm:block"
              aria-label={t('common', 'wishlist')}
            >
              ♡
              {wishlist.length > 0 && (
                <span className="absolute -end-2 -top-2 text-[10px] text-gold">{wishlist.length}</span>
              )}
            </Link>
            <Link
              to={`/${locale}/cart`}
              className="relative text-xs uppercase tracking-widest text-noir hover:text-gold"
              aria-label={t('common', 'cart')}
            >
              {t('common', 'cart')}
              {cartCount > 0 && (
                <span className="absolute -end-2.5 -top-2 rounded-full bg-gold px-1 text-[10px] text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t('common', 'menu')}
              aria-expanded={menuOpen}
              className="-me-1 p-1 text-xl leading-none text-noir xl:hidden"
            >
              <span aria-hidden="true">☰</span>
            </button>
          </div>
        </div>
      </div>

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={links}
        brandItems={brandItems}
        categoryItems={categoryItems}
        isNewRoute={isNewRoute}
      />
    </header>
  )
}
