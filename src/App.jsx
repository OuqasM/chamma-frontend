import { useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AdminProvider } from './context/AdminContext'
import { Layout } from './layouts/Layout'
import { AdminLayout, RequireAuth } from './layouts/AdminLayout'
import { LOCALES, normalize } from './lib/i18n'
import Home from './pages/Home'
import Catalogue from './pages/Catalogue'
import Product from './pages/Product'
import Taxonomy from './pages/Taxonomy'
import Checkout from './pages/Checkout'
import Wishlist from './pages/Wishlist'
import { OrderConfirmation, OrderLookup, NotFound } from './pages/Order'
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminProducts from './pages/admin/Products'
import AdminProductEdit from './pages/admin/ProductEdit'
import AdminCategories from './pages/admin/Categories'
import AdminBrands from './pages/admin/Brands'
import AdminOrders from './pages/admin/Orders'
import AdminOrderDetail from './pages/admin/OrderDetail'
import AdminSettings from './pages/admin/Settings'
import AdminVisits from './pages/admin/Visits'
import AdminWaitlist from './pages/admin/Waitlist'

/**
 * Every storefront page lives under the locale prefix, so the locale is a
 * route segment rather than app state: /fr/..., /ar/..., /en/...
 */
function LocaleShell() {
  return (
    <Layout>
      <ScrollToTop />
      <Outlet />
    </Layout>
  )
}

/**
 * Resets the window scroll to the top when the route changes.
 *
 * React Router does not touch the scroll position on navigation, and this app
 * uses `<Routes>` rather than the data router, so there is no `ScrollRestoration`
 * either. The browser therefore keeps the offset it had on the previous page and
 * simply re-renders the new page at that offset. When the new page is shorter
 * than the old scroll depth the browser clamps to the maximum, so opening a
 * product or a brand from a scrolled catalogue landed the shopper at the *bottom*
 * of the new page with its header out of sight.
 *
 * Deliberate details:
 *
 * - Keyed on `pathname`, plus the navigation type so a clicked link works even
 *   when the pathname does not move. The header's "Shop" keeps `/products` and
 *   flips only the query string: a click on it from `/products?page=2` is a
 *   request to be on that page and has to start it at the top, but pathname
 *   alone cannot tell it from the page's *filter* writes, which never reset.
 *   Those are `useSearchParams` `replace`s on the exact same pathname — a
 *   filter chip or the mobile sheet updating the list in place — and a
 *   `REPLACE` that leaves the pathname standing is skipped here. Everything
 *   else a user can click is a push, so `PUSH` and `POP` always reset.
 * - It runs on mount as well as on a change. `index.html` turns the browser's
 *   own scroll restoration off, so there is no saved offset to fight; running
 *   here too is what guarantees a reload starts at the top on a browser that
 *   ignores that setting.
 * - The catalogue's own pagination and sorting do not push — they `replace`
 *   through `useSearchParams` — so they are covered by `Catalogue`, which
 *   scrolls when `page` or `sort` changes.
 * - `behavior: 'instant'`. A smooth scroll between pages reads as lag, not as
 *   polish, and it also fights the smooth `scrollBy` inside `Carousel`.
 * - `left: 0` alongside `top: 0`, since a horizontally scrolled page carries that
 *   over too.
 *
 * A `hash` is left to the browser's own anchor handling rather than being
 * scrolled to here.
 */
function ScrollToTop() {
  const { pathname, key } = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef(null)

  useEffect(() => {
    // A query-only `replace` is the catalogue editing its filters in place —
    // never a trip to another page, and exactly what must not yank the scroll.
    if (previous.current === pathname && navigationType === 'REPLACE') return
    previous.current = pathname
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    // `key` changes on every history write, including pushes that leave the
    // pathname standing — a second click on a header link to the page you are
    // already on must still scroll, and `pathname` alone would skip it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return null
}

/** Sends an unsupported or missing locale to a supported one, once. */
function LocaleRedirect() {
  return <Navigate to={`/${normalize(window.location.pathname.split('/')[1] || navigator.language?.slice(0, 2))}`} replace />
}

/**
 * `/admin/...` is not a locale, so it cannot be swallowed by the storefront
 * catch-all: keep the admin path and only insert the detected locale in front.
 */
function AdminLocaleRedirect() {
  const { pathname, search } = window.location
  const rest = pathname.replace(/^\/admin/, '')
  return <Navigate to={`/${normalize(navigator.language?.slice(0, 2))}/admin${rest}${search}`} replace />
}

/**
 * Keyed on the product being edited, so the form is rebuilt whenever that
 * changes. `products/new` matches no `:id`, so it keys on 'new' and reads the
 * prefill handed over by "duplicate" on its first render.
 */
function ProductEditRoute() {
  const { id } = useParams()

  return <AdminProductEdit key={id ?? 'new'} />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/:locale" element={<LocaleShell />}>
            <Route index element={<Home />} />
            <Route path="products" element={<Catalogue />} />
            <Route path="products/:slug" element={<Product />} />
            <Route path="brands/:slug" element={<Taxonomy kind="brands" />} />
            <Route path="categories/:slug" element={<Taxonomy kind="categories" />} />
            <Route path="offers" element={<Catalogue mode="offers" />} />
            <Route path="search" element={<Catalogue mode="search" />} />
            <Route path="new" element={<Navigate to="products?sort=newest" replace />} />
            {/* The cart page was merged into checkout: the order form and the
              lines it applies to are one screen now. Redirected rather than
              removed so a bookmarked or already-shared /cart still lands
              somewhere useful. */}
            <Route path="cart" element={<Navigate to="../checkout" replace />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="order" element={<OrderLookup />} />
            <Route path="order/:reference" element={<OrderConfirmation />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* The admin has its own shell, so it sits beside the storefront tree
              rather than inside it: no store header, nav or footer. */}
          <Route path="/:locale/admin/login" element={<AdminProvider><AdminLogin /></AdminProvider>} />
          <Route path="/:locale/admin" element={<AdminProvider><RequireAuth /></AdminProvider>}>
            <Route element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              {/* The key is what makes "duplicate" work, and stops one product's
                  form surviving into the next: without it React Router reuses the
                  component across /products/new, /products/1 and /products/2, so
                  the prefill in the navigation state is never read and the form
                  being left behind is the one that stays on screen. */}
              <Route path="products/new" element={<ProductEditRoute />} />
              <Route path="products/:id" element={<ProductEditRoute />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="brands" element={<AdminBrands />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="orders/:id" element={<AdminOrderDetail />} />
              <Route path="waitlist" element={<AdminWaitlist />} />
              <Route path="visits" element={<AdminVisits />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
          </Route>

          <Route path="/admin/*" element={<AdminLocaleRedirect />} />
          <Route path="/" element={<LocaleRedirect />} />
          <Route path="*" element={<LocaleRedirect />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
