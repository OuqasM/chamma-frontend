/**
 * Thin API client.
 *
 * The backend is the single source of truth: catalogue text, prices, stock
 * and shipping are always read from the API, never cached in the browser.
 * `VITE_API_URL` is empty by default so dev/prod both go through the Vite
 * proxy (or same-origin) and never need CORS.
 */
const RAW_BASE = import.meta.env.VITE_API_URL || ''
const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, { status, errors } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors || {}
  }
}

function url(path, params) {
  const target = `${BASE}${path}`
  if (!params) return target
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `${target}?${query}` : target
}

async function request(path, { locale, method = 'GET', body, params, signal, auth } = {}) {
  const headers = { Accept: 'application/json' }

  // Uploads send FormData so the browser can set the multipart boundary itself;
  // everything else is JSON.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  // Falls back to the pre-rename `chama_admin_token` so an existing session
  // survives the brand-key rename.
  const token = auth
    ? localStorage.getItem('chamma_admin_token') ?? localStorage.getItem('chama_admin_token')
    : null
  if (token) headers.Authorization = `Bearer ${token}`

  // The backend namespaces the whole storefront under the locale prefix
  // (/api/fr/home); the client passes the locale, not the full path.
  const path_ = locale ? `/${locale}${path}` : path

  const res = await fetch(url(path_, params), {
    method,
    headers,
    signal,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()

  // A gateway or web server can answer with an HTML error page (413, 502,
  // a proxy timeout) instead of JSON. Parsing that blindly throws a raw
  // "Unexpected token '<'" that hides what actually went wrong.
  let data = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      if (res.status === 413) {
        throw new ApiError('Image too large. Please choose a file under 10 MB.', { status: 413 })
      }
      throw new ApiError(`HTTP ${res.status} (unexpected response from the server)`, { status: res.status })
    }
  }

  if (!res.ok) {
    throw new ApiError(data.message || `HTTP ${res.status}`, {
      status: res.status,
      errors: data.errors,
    })
  }

  return data
}

const scoped = (locale) => (path, opts = {}) => request(path, { ...opts, locale })

export const api = {
  // Storefront — locale is part of the path.
  home: (l) => scoped(l)('/home'),
  navigation: (l) => scoped(l)('/navigation'),
  offers: (l, params, opts) => scoped(l)('/offers', { ...opts, params }),
  products: (l, params, opts) => scoped(l)('/products', { ...opts, params }),
  product: (l, slug, opts) => scoped(l)(`/products/${encodeURIComponent(slug)}`, opts),
  brands: (l) => scoped(l)('/brands'),
  brand: (l, slug, opts) => scoped(l)(`/brands/${encodeURIComponent(slug)}`, opts),
  categories: (l) => scoped(l)('/categories'),
  category: (l, slug, opts) => scoped(l)(`/categories/${encodeURIComponent(slug)}`, opts),
  search: (l, params, opts) => scoped(l)('/search', { ...opts, params }),

  // Checkout.
  checkoutOptions: (l) => request(`/${l}/checkout/options`),
  quote: (l, body) => request(`/${l}/checkout/quote`, { method: 'POST', body }),
  checkout: (l, body) => request(`/${l}/checkout`, { method: 'POST', body }),
  order: (l, reference, phone) => request(`/${l}/orders/${encodeURIComponent(reference)}`, { params: { phone } }),
}

/**
 * Admin API.
 *
 * Unlike the storefront these routes are locale independent: the locale
 * travels as `?locale=` so one authenticated surface serves every language.
 * That means no path prefix here — only `params.locale` — and every call is
 * authenticated with the Sanctum token.
 */
const admin = (locale, path, opts = {}) =>
  request(path, { ...opts, auth: true, params: { locale, ...(opts.params || {}) } })

export const adminApi = {
  // Auth. Login is the one locale-prefixed admin route, so a failure comes back
  // translated in the admin's own language.
  login: (l, body) => request(`/${l}/admin/login`, { method: 'POST', body }),
  me: (l, opts) => admin(l, '/admin/me', opts),
  logout: (l, opts) => admin(l, '/admin/logout', { ...opts, method: 'POST' }),

  dashboard: (l, opts) => admin(l, '/admin/dashboard', opts),

  // Products.
  products: (l, params, opts) => admin(l, '/admin/products', { ...opts, params }),
  product: (l, id, opts) => admin(l, `/admin/products/${id}`, opts),
  createProduct: (l, body) => admin(l, '/admin/products', { method: 'POST', body }),
  updateProduct: (l, id, body) => admin(l, `/admin/products/${id}`, { method: 'PUT', body }),
  toggleProduct: (l, id) => admin(l, `/admin/products/${id}/toggle`, { method: 'PATCH' }),
  deleteProduct: (l, id) => admin(l, `/admin/products/${id}`, { method: 'DELETE' }),
  restoreProduct: (l, id) => admin(l, `/admin/products/${id}/restore`, { method: 'POST' }),

  // Brands.
  brands: (l, opts) => admin(l, '/admin/brands', opts),
  createBrand: (l, body) => admin(l, '/admin/brands', { method: 'POST', body }),
  updateBrand: (l, id, body) => admin(l, `/admin/brands/${id}`, { method: 'PUT', body }),
  deleteBrand: (l, id) => admin(l, `/admin/brands/${id}`, { method: 'DELETE' }),

  // Categories.
  categories: (l, opts) => admin(l, '/admin/categories', opts),
  createCategory: (l, body) => admin(l, '/admin/categories', { method: 'POST', body }),
  updateCategory: (l, id, body) => admin(l, `/admin/categories/${id}`, { method: 'PUT', body }),
  deleteCategory: (l, id) => admin(l, `/admin/categories/${id}`, { method: 'DELETE' }),

  // Orders.
  orders: (l, params, opts) => admin(l, '/admin/orders', { ...opts, params }),
  order: (l, id, opts) => admin(l, `/admin/orders/${id}`, opts),
  updateOrderStatus: (l, id, status) =>
    admin(l, `/admin/orders/${id}/status`, { method: 'PATCH', body: { status } }),

  // Uploads. `upload` takes a File, `artwork` renders a bottle shot server-side.
  upload: (l, file) => {
    const body = new FormData()
    body.append('image', file)
    return admin(l, '/admin/uploads', { method: 'POST', body })
  },
  artwork: (l, payload) => admin(l, '/admin/uploads/artwork', { method: 'POST', body: payload }),
}

/** Product URLs come back from the API already locale-qualified (e.g. /fr/products/x). */
export function productHref(url, locale) {
  if (!url) return `/${locale}/products`
  return /^\/[a-z]{2}\//i.test(url) ? url : `/${locale}${url}`
}

/** Normalises image URLs so they resolve through the proxy in dev. */
export function imageUrl(url) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) {
    if (!RAW_BASE) {
      // Same-origin proxy: strip the API origin so /images/... is used.
      try {
        return new URL(url).pathname
      } catch {
        return url
      }
    }
    return url
  }
  // The API keeps media in the document root under `images/` (the `storefront`
  // disk), and hands out a bare relative path in `image.path` / `image_path` /
  // `logo_path` and in the upload response. Those need the `images/` prefix to
  // resolve, or the browser 404s on e.g. /uploads/x.png instead of
  // /images/uploads/x.png.
  if (url.startsWith('/images/')) return url
  return url.startsWith('/') ? url : `/images/${url}`
}
