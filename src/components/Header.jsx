import { useEffect, useRef, useState } from 'react'
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
  const { mounted, shown } = useOverlayTransition(open, DROPDOWN_MS)

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
          data-open={shown}
          className="dropdown absolute end-0 z-50 mt-2 w-36 border border-stone-200 bg-ivory py-1 shadow-lg"
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

/**
 * A top-level nav entry that opens a full-width sheet under the header.
 *
 * The panel is portalled to <body> for two reasons: the header is a backdrop
 * filter, and a filtered ancestor becomes the containing block for
 * `position: fixed`, which would size the sheet to the header strip instead of
 * the viewport. The nav is also a horizontal scroll container, which would clip
 * an in-flow panel outright.
 *
 * Hover opens it, but on a short delay and with a matching grace period on the
 * way out, so sweeping the cursor across the bar to reach a link does not flash
 * every menu open in turn. Escape and a click outside both close it.
 *
 * The sheet is capped to the space between the header and the bottom of the
 * viewport and scrolls inside that cap. It is `position: fixed` and full width,
 * so anything past the fold used to be unreachable: the page underneath cannot
 * scroll under the sheet, and the sheet itself did not scroll. Capping it makes
 * every category reachable at any window height or taxonomy size.
 */
function MegaMenu({ label, items, kind, active, to, onNavigate }) {
  const [open, setOpen] = useState(false)
  const [top, setTop] = useState(0)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const openTimer = useRef(null)
  const closeTimer = useRef(null)
  const { mounted, shown } = useOverlayTransition(open, MEGA_MS)

  // Only the route, never `items`: the parent rebuilds that array on every
  // render, so depending on it closed the sheet the instant it opened.
  useEffect(() => {
    setOpen(false)
  }, [to])

  useEffect(() => () => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
  }, [])

  // The sheet is hover-driven but must also yield to a click elsewhere, or it
  // sits over the page. Outside means outside the trigger *and* the portalled
  // panel, which are in different trees.
  useEffect(() => {
    if (!open) return

    const onDown = (e) => {
      const inTrigger = triggerRef.current?.contains(e.target)
      const inPanel = panelRef.current?.contains(e.target)

      if (!inTrigger && !inPanel) setOpen(false)
    }

    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) setTop(triggerRef.current?.getBoundingClientRect().bottom ?? 0)
  }, [open, mounted])

  // Nothing is clickable or focusable once the sheet is gone, and a hidden
  // sheet must not sit over the page swallowing clicks.
  useEffect(() => {
    if (!mounted) return
    panelRef.current?.setAttribute('data-shown', String(shown))
  }, [mounted, shown])

  const clearTimers = () => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
  }

  // Pointer only: a touch tap has no hover, so the trigger opens on click.
  const show = () => {
    clearTimers()
    openTimer.current = setTimeout(() => setOpen(true), 90)
  }

  const hide = () => {
    clearTimers()
    closeTimer.current = setTimeout(() => setOpen(false), 160)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={show}
        onMouseLeave={hide}
        aria-haspopup="true"
        aria-expanded={open}
        className={`nav-link whitespace-nowrap py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition ${
          active ? 'is-current text-noir' : 'text-stone-500 hover:text-noir'
        }`}
      >
        {label}
        <span aria-hidden="true" className="ms-1.5 text-[8px] align-middle">▾</span>
      </button>

      {mounted &&
        createPortal(
          <div
            ref={panelRef}
            onMouseEnter={show}
            onMouseLeave={hide}
            data-open={shown}
            style={{
              position: 'fixed',
              top,
              left: 0,
              right: 0,
              // Whatever is left under the header. `top` is the header's own
              // measured bottom, so this tracks the real gap on any window.
              maxHeight: `calc(100vh - ${top}px)`,
              pointerEvents: shown ? 'auto' : 'none',
            }}
            className="mega z-30 hidden overflow-y-auto overscroll-contain border-b border-stone-200 bg-ivory shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)] xl:block"
          >
            <div className="mx-auto max-w-7xl px-8 py-6">
              <div className="flex items-baseline gap-4">
                <h2 className="font-serif text-xl font-bold uppercase tracking-[0.18em] text-noir">{label}</h2>
                <span aria-hidden="true" className="h-px flex-1 bg-stone-200" />
              </div>

              {kind === 'categories' ? (
                /* Four columns, and a fixed-height letterbox crop rather than a
                   4/3 frame. A 4/3 image in three columns is ~225px tall, which
                   put eight categories at ~950px — past the fold on any laptop.
                   The crop keeps the photograph, which is the point of the sheet,
                   and drops the row to ~130px. */
                <ul className="mt-5 grid grid-cols-4 gap-x-6 gap-y-5">
                  {items.map((it) => (
                    <li key={it.id}>
                      <Link
                        to={it.to}
                        onClick={() => {
                          setOpen(false)
                          onNavigate?.()
                        }}
                        className="group block"
                      >
                        {it.image && (
                          <span className="block h-24 overflow-hidden bg-stone-100">
                            <img
                              src={it.image}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                            />
                          </span>
                        )}
                        <span className="mt-2.5 block font-serif text-base font-bold text-noir transition group-hover:text-gold">
                          {it.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-5 grid grid-cols-4 gap-x-6 gap-y-4">
                  {items.map((it) => (
                    <li key={it.id}>
                      <Link
                        to={it.to}
                        onClick={() => {
                          setOpen(false)
                          onNavigate?.()
                        }}
                        className="group block border-t border-stone-200 pt-2.5"
                      >
                        <span className="block font-serif text-base font-bold text-noir transition group-hover:text-gold">
                          {it.name}
                        </span>
                        {it.tagline && (
                          <span className="mt-1 block text-[11px] leading-relaxed text-stone-500">{it.tagline}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function HeaderMenus({ onNavigate }) {
  const { locale, t, nav } = useApp()
  const location = useLocation()

  // The mega sheet is built from what the navigation endpoint already returns:
  // category photographs and brand taglines. Nothing extra is fetched.
  const brandItems = (nav?.brands || []).map((b) => ({
    id: b.id,
    name: b.name,
    tagline: b.tagline,
    to: `/${locale}/brands/${b.slug}`,
  }))

  const categoryItems = (nav?.categories || []).map((c) => ({
    id: c.id,
    name: c.name,
    image: c.image?.url,
    to: `/${locale}/categories/${c.slug}`,
  }))

  return (
    <>
      <MegaMenu
        label={t('nav', 'categories')}
        items={categoryItems}
        kind="categories"
        to={location.pathname}
        onNavigate={onNavigate}
        active={location.pathname.startsWith(`/${locale}/categories/`)}
      />
      <MegaMenu
        label={t('nav', 'brands')}
        items={brandItems}
        kind="brands"
        to={location.pathname}
        onNavigate={onNavigate}
        active={location.pathname.startsWith(`/${locale}/brands/`)}
      />
    </>
  )
}

/**
 * The same two menus, folded into the drawer on small screens: a portal
 * dropdown would be clipped by the panel, so they collapse in place instead.
 *
 * `defaultOpen` starts the section expanded. Categories use it: they are the
 * route most shoppers in the drawer are heading for, and the panel scrolls, so
 * an open list costs nothing. Brands stay collapsed — fewer of them, and they
 * are the more deliberate choice.
 */
function DrawerSection({ label, items, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  if (!items.length) return null

  return (
    /* The trigger is a nav row like every other one in the panel, so it carries
       the same rule, padding and type. It previously led with a 10px gold
       micro-cap, which read as a red annotation rather than as a destination. */
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="nav-link group flex w-full items-center justify-between border-b border-stone-200/80 py-4 text-start"
      >
        <span className="font-serif text-lg font-bold tracking-wide text-stone-600 transition group-hover:text-noir">
          {label}
        </span>
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 items-center justify-center rounded-full border text-[9px] leading-none transition duration-300 ${
            open
              ? 'rotate-180 border-stone-400 text-noir'
              : 'border-stone-300 text-stone-500 group-hover:border-stone-400 group-hover:text-noir'
          }`}
        >
          ▾
        </span>
      </button>

      {/* Animating the row height keeps the links below it from jumping.
          min-h-0 on the list is what makes the collapse possible at all: a grid
          item defaults to min-height auto, so a 0fr row could not shrink it
          below its content and the first link stayed poking out. */}
      <div
        data-open={open}
        className={`accordion grid ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        aria-hidden={!open}
      >
        <ul className="min-h-0 overflow-hidden pb-4 pe-1 ps-4">
          {items.map((it, i) => (
            <li key={it.id} className="accordion-item" style={{ '--i': i }}>
              <Link
                to={it.to}
                tabIndex={open ? undefined : -1}
                className="nav-link block py-2 font-serif text-base font-semibold text-stone-600 transition hover:text-noir"
              >
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
const DRAWER_MS = 380
// Matches the `transition` duration of `.mega` in index.css.
const MEGA_MS = 260
// Matches the `transition` duration of `.dropdown` in index.css.
const DROPDOWN_MS = 180

/**
 * The two phases an animated panel or menu needs.
 *
 * `mounted` — keep the element in the document for the length of its exit
 * transition. Unmounting the instant `open` flips to false leaves no frame to
 * animate, which is why these menus used to snap in and out.
 *
 * `shown` — one frame behind `open` on the way in. An element that mounts
 * already-open has its *final* computed style on the first paint, so the
 * browser has nothing to transition from and it simply appears. Mounting it
 * closed and flipping `shown` on the next frame gives the transition a
 * starting position.
 */
function useOverlayTransition(open, ms) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    // Collapses straight away, then stays mounted long enough to slide out.
    setShown(false)
    if (!mounted) return
    const timer = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(timer)
  }, [open, mounted, ms])

  useEffect(() => {
    if (!open || !mounted) return
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [open, mounted])

  return { mounted, shown }
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

  // The panel stays mounted for the length of the exit transition, and only
  // reaches its open position a frame after mounting, so it slides in from the
  // edge instead of appearing.
  const { mounted, shown } = useOverlayTransition(open, DRAWER_MS)

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
        data-open={shown}
        className="drawer-backdrop absolute inset-0 bg-noir/50 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('common', 'menu')}
        data-open={shown}
        className="drawer absolute inset-y-0 start-0 flex w-[min(21rem,86vw)] flex-col bg-ivory shadow-2xl"
      >
        <div className="shrink-0 border-b border-stone-200 bg-ivory px-7 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-3">
            {/* The same lockup as the header, so the drawer reads as the site
                rather than as a separate widget. The mark leads here and the
                wordmark follows it: the drawer is the only place the storefront
                shows its logo on a screen too narrow to carry both at full
                size. */}
            <Link to={`/${locale}`} onClick={onClose} className="group flex items-center gap-3">
              <img
                src="/chamma-store-logo.png"
                alt="Chamma"
                width="44"
                height="44"
                className="h-11 w-11 shrink-0 transition group-hover:opacity-80"
              />
              <span className="flex flex-col">
                <span className="font-serif text-xl font-bold uppercase leading-none tracking-[0.3em] text-noir transition group-hover:text-gold">
                  Chamma
                </span>
                <span aria-hidden="true" className="mt-1.5 block h-px w-full bg-gold/50" />
              </span>
            </Link>


            {/* The language list drops below the trigger, so it lives up here
                rather than at the foot of the panel, where the scroll area would
                clip it. */}
            <div className="flex shrink-0 items-center gap-2">
              <LocaleSwitcher />
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common', 'close')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-sm leading-none text-stone-500 transition hover:border-gold hover:text-gold"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="mt-6">
            <SearchBar onNavigate={onClose} block />
          </div>
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-7 pb-8">
          {links.map((l) => (
            <NavLink
              key={l.key}
              to={l.to}
              end={l.end}
              onClick={onClose}
              className={({ isActive }) => {
                const active = isActive && linkIsActive(l.key, isActive, isNewRoute)

                return [
                  'nav-link border-b border-stone-200/80 py-4 font-serif text-lg font-bold tracking-wide transition',
                  active ? 'is-current text-noir' : 'text-stone-600 hover:text-noir',
                ].join(' ')
              }}
            >
              {l.label}
            </NavLink>
          ))}

          {/* Brands lead, categories follow and categories start open. */}
          <DrawerSection label={t('nav', 'brands')} items={brandItems} />
          <DrawerSection label={t('nav', 'categories')} items={categoryItems} defaultOpen />
        </nav>

        <div className="shrink-0 border-t border-stone-200 bg-ivory px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <DrawerFooterLink to={`/${locale}/wishlist`} onClick={onClose} label={t('common', 'wishlist')} count={wishlist.length} />
            <DrawerFooterLink to={`/${locale}/cart`} onClick={onClose} label={t('common', 'cart')} count={cartCount} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Wishlist and cart sit along the bottom as a matched pair, the count riding
    in a gold pill so it reads as a figure rather than loose text. */
function DrawerFooterLink({ to, onClick, label, count }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-2 border border-stone-300 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-700 transition hover:border-gold hover:text-noir"
    >
      {label}
      {count > 0 && <span className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] leading-none text-white">{count}</span>}
    </Link>
  )
}

function SearchBar({ onNavigate, block = false }) {
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
        className={
          block
            ? 'w-full border border-stone-300 bg-ivory px-4 py-3 text-sm font-semibold text-noir outline-none transition placeholder:font-normal placeholder:text-stone-400 focus:border-gold'
            : 'w-32 border-b border-noir/20 bg-transparent py-1 text-xs outline-none transition focus:w-44 focus:border-gold md:w-44 md:focus:w-56'
        }
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

  // The drawer needs the same two taxonomies, without the imagery and taglines
  // the mega sheet shows.
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

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-ivory/95 backdrop-blur">
      {/* A hairline tier carrying only the language switch. It earns its place
          by lifting the language picker out of the main bar, where it was
          competing with the cart for the same few pixels. */}
      <div className="hidden border-b border-stone-200/70 xl:block">
        <div className="mx-auto flex max-w-7xl justify-end px-8 py-1.5">
          <LocaleSwitcher />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 xl:px-8">
        <div className="flex items-center gap-x-5 gap-y-2 py-4 xl:gap-x-9 xl:py-5">
          <Link to={`/${locale}`} aria-label="Chamma Store" className="group flex shrink-0 flex-col">
            <span className="font-serif text-xl font-bold uppercase leading-none tracking-[0.3em] text-noir transition group-hover:text-gold xl:text-2xl">
              Chamma
            </span>
            <span
              aria-hidden="true"
              className="mt-1.5 block h-px w-full bg-gold/50"
            />
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center gap-7 xl:flex" aria-label="Main">
            {links.map((l) => (
              <NavLink
                key={l.key}
                to={l.to}
                end={l.end}
                className={({ isActive }) => {
                  const current = linkIsActive(l.key, isActive, isNewRoute)

                  return [
                    'nav-link whitespace-nowrap py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition',
                    current ? 'is-current text-noir' : 'text-stone-500 hover:text-noir',
                  ].join(' ')
                }}
              >
                {l.label}
              </NavLink>
            ))}

            <HeaderMenus />
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-5 xl:ms-0 xl:gap-6">
            <div className="hidden sm:block">
              <SearchBar />
            </div>
            <div className="hidden sm:block xl:hidden">
              <LocaleSwitcher />
            </div>
            <Link
              to={`/${locale}/wishlist`}
              className="relative hidden text-sm text-noir transition hover:text-gold sm:block"
              aria-label={t('common', 'wishlist')}
            >
              ♡
              {wishlist.length > 0 && (
                <span className="absolute -end-2 -top-2 text-[10px] text-gold">{wishlist.length}</span>
              )}
            </Link>
            <Link
              to={`/${locale}/cart`}
              className="relative flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-noir transition hover:text-gold"
              aria-label={t('common', 'cart')}
            >
              <span aria-hidden="true" className="text-sm">🛒</span>
              <span className="hidden sm:inline">{t('common', 'cart')}</span>
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
              className="-me-1 p-1 text-xl leading-none text-noir transition hover:text-gold xl:hidden"
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
