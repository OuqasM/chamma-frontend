import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AdminProvider } from './context/AdminContext'
import { Layout } from './layouts/Layout'
import { AdminLayout, RequireAuth } from './layouts/AdminLayout'
import { LOCALES, normalize } from './lib/i18n'
import Home from './pages/Home'
import Catalogue from './pages/Catalogue'
import Product from './pages/Product'
import Taxonomy from './pages/Taxonomy'
import Cart from './pages/Cart'
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

/**
 * Every storefront page lives under the locale prefix, so the locale is a
 * route segment rather than app state: /fr/..., /ar/..., /en/...
 */
function LocaleShell() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
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
            <Route path="new" element={<Navigate to="products?is_new=1" replace />} />
            <Route path="cart" element={<Cart />} />
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
              <Route path="products/new" element={<AdminProductEdit />} />
              <Route path="products/:id" element={<AdminProductEdit />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="brands" element={<AdminBrands />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="orders/:id" element={<AdminOrderDetail />} />
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
