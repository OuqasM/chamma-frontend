import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { dictionaries, normalize, dirFor, fromAcceptLanguage, DEFAULT_LOCALE } from '../lib/i18n'
import { api } from '../lib/api'

const AppContext = createContext(null)

// Storage keys were renamed from `chama_*` to `chamma_*` with the brand. Read
// the legacy key as a fallback so carts and wishlists saved before the rename
// are carried over instead of silently vanishing.
const readStored = (key) => {
  try {
    const raw = localStorage.getItem(key) ?? localStorage.getItem(key.replace('chamma_', 'chama_'))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const readCart = () => readStored('chamma_cart')

// Walks a dotted key so a group can hold a table of related strings —
// `t('common', 'sortOptions.price_asc')` — without every caller reaching for
// the dictionary itself. Returns undefined on any missing step rather than
// throwing on a partially present path, so one missing translation inside a
// nested group falls back like any other. Module scope: it holds no state and
// `t` is memoised, so rebuilding it on every render would buy nothing.
const lookup = (dict, path) => path.reduce((node, step) => (node == null ? undefined : node[step]), dict)

const readWishlist = () => readStored('chamma_wishlist')

export function AppProvider({ children }) {
  const location = useLocation()
  const navigate = useNavigate()

  // Locale is always the first URL segment: /fr/..., /ar/..., /en/...
  const locale = normalize(location.pathname.split('/')[1])

  const [cart, setCart] = useState(readCart)
  const [wishlist, setWishlist] = useState(readWishlist)
  const [nav, setNav] = useState(null)
  // The footer's social links and contact details. They arrive in the same
  // navigation response rather than in a request of their own, so the footer
  // costs no extra round trip on first paint.
  const [contact, setContact] = useState(null)

  const t = useCallback(
    (group, key, vars) => {
      const path = String(key).split('.')
      const raw =
        lookup(dictionaries[locale]?.[group], path) ??
        lookup(dictionaries[DEFAULT_LOCALE]?.[group], path) ??
        key
      if (!vars) return raw
      return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), raw)
    },
    [locale],
  )

  // Keep the document in sync so CSS logical properties and screen readers
  // both see the right language and writing direction.
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dirFor(locale)
  }, [locale])

  useEffect(() => {
    localStorage.setItem('chamma_cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    localStorage.setItem('chamma_wishlist', JSON.stringify(wishlist))
  }, [wishlist])

  // Navigation labels are language-specific, so they reload per locale.
  useEffect(() => {
    let alive = true
    api
      .navigation(locale)
      .then((data) => {
        if (!alive) return
        setNav(data)
        setContact(data?.contact ?? null)
      })
      // A failed bootstrap leaves `nav` null and the header hides its mega
      // menu; the footer must not render a column of links to nowhere either.
      .catch(() => {
        if (!alive) return
        setNav(null)
        setContact(null)
      })
    return () => {
      alive = false
    }
  }, [locale])

  // Slugs are translated, so a product page cannot just keep its own path segment.
  // The product detail registers its full localized paths here.
  const [alternates, setAlternates] = useState({})

  const setLocale = useCallback(
    (next) => {
      const target = normalize(next)
      if (alternates[target]) {
        navigate(`${alternates[target]}${location.search}`)
        return
      }
      const rest = location.pathname.replace(/^\/(fr|ar|en)(?=\/|$)/, '')
      navigate(`/${target}${rest}${location.search}`)
    },
    [location.pathname, location.search, navigate, alternates],
  )

  const addToCart = useCallback((product, quantity = 1) => {
    setCart((prev) => {
      const found = prev.find((l) => l.id === product.id)
      if (found) {
        return prev.map((l) => (l.id === product.id ? { ...l, quantity: Math.min(l.quantity + quantity, 20) } : l))
      }
      return [
        ...prev,
        {
          id: product.id,
          slug: product.slug,
          name: product.name,
          image: product.image?.url || product.primary_image?.url || product.preview?.url || null,
          price: product.price,
          compare_at_price: product.compare_at_price ?? null,
          stock: product.stock ?? null,
          quantity: Math.min(quantity, 20),
        },
      ]
    })
  }, [])

  const setQuantity = useCallback((id, quantity) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.id !== id)
        : prev.map((l) => (l.id === id ? { ...l, quantity: Math.min(quantity, 20) } : l)),
    )
  }, [])

  const removeFromCart = useCallback((id) => setCart((prev) => prev.filter((l) => l.id !== id)), [])

  const clearCart = useCallback(() => setCart([]), [])

  const toggleWishlist = useCallback((product) => {
    setWishlist((prev) =>
      prev.some((l) => l.id === product.id)
        ? prev.filter((l) => l.id !== product.id)
        : [...prev, { id: product.id, slug: product.slug, name: product.name, image: product.image?.url || null, price: product.price }],
    )
  }, [])

  const inWishlist = useCallback((id) => wishlist.some((l) => l.id === id), [wishlist])

  const value = useMemo(
    () => ({
      locale,
      t,
      dir: dirFor(locale),
      nav,
      contact,
      cart,
      addToCart,
      setQuantity,
      removeFromCart,
      clearCart,
      wishlist,
      toggleWishlist,
      inWishlist,
      setLocale,
      alternates,
      setAlternates,
      cartCount: cart.reduce((n, l) => n + l.quantity, 0),
      cartSubtotal: cart.reduce((n, l) => n + Number(l.price) * l.quantity, 0),
    }),
    [locale, t, nav, contact, cart, addToCart, setQuantity, removeFromCart, clearCart, wishlist, toggleWishlist, inWishlist, setLocale, alternates, setAlternates],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
