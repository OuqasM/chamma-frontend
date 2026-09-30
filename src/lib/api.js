/**
 * Thin API client.
 *
 * The backend is the single source of truth: catalogue text, prices, stock
 * and shipping are always read from the API, never cached in the browser.
 *
 * `VITE_API_URL` is the API origin and is empty by default: local development
 * and a single origin deployment leave it unset, so every request is relative
 * and goes through the Vite proxy without needing CORS. It is set when the
 * storefront is served from a different host than the API, in which case
 * requests are cross-origin and the API has to allow the storefront origin.
 */
const ORIGIN = import.meta.env.VITE_API_URL || ''
const BASE = `${ORIGIN}${import.meta.env.VITE_API_BASE || '/api'}`.replace(/\/$/, '')

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

  // Back-in-stock waiting list. A phone number and nothing else: the store can
  // only call, so there is nothing to send an email or a name to. The locale
  // travels in the path because it decides the language the store replies in,
  // and the API resolves it there rather than from a body field.
  joinWaitlist: (l, slug, body) =>
    request(`/${l}/products/${encodeURIComponent(slug)}/waitlist`, { method: 'POST', body }),
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
  toggleProductAvailability: (l, id) => admin(l, `/admin/products/${id}/availability`, { method: 'PATCH' }),
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
  // Visitor tracking. Read-only — the backend writes these rows from the
  // storefront middleware, so there is no create/update/delete here.
  visits: (l, params, opts) => admin(l, '/admin/visits', { ...opts, params }),

  // Waiting list. There is no delete: a number here is a person who gave it,
  // and the panel marks people as contacted rather than erasing them.
  waitlist: (l, params, opts) => admin(l, '/admin/waitlist', { ...opts, params }),
  addToWaitlist: (l, body) => admin(l, '/admin/waitlist', { method: 'POST', body }),
  markWaitlistNotified: (l, body) => admin(l, '/admin/waitlist/notified', { method: 'PATCH', body }),

  // Settings. Where order alerts go is edited here rather than in .env because
  // who is on duty changes without a deploy.
  settings: (l, opts) => admin(l, '/admin/settings', opts),
  updateSettings: (l, body) => admin(l, '/admin/settings', { method: 'PUT', body }),
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

/**
 * Normalises image URLs so each one resolves against the host that serves it.
 *
 * The API keeps its media in its own document root under `images/`, while the
 * storefront ships its own files (the bank transfer slip). With the API on a
 * separate host, `images/` paths have to carry the API origin or the browser
 * looks for them on the storefront and gets a 404; with a shared origin the
 * API origin is stripped so everything resolves through this host.
 */
/**
 * Builds a social profile URL from whatever the API has for that network.
 *
 * The API stores bare handles (`chamma_store_`, `angelofheaven88`) rather than
 * URLs, so the tracking parameters that come with a link pasted out of a QR code
 * or a share sheet — `?stkn=…`, `?utm_source=qr`, `?_r=1&_t=…` — never reach a
 * committed file, and the same value still works if it is later typed into an
 * env file as a handle, an `@handle` or a whole profile URL.
 *
 * Returns an empty string when there is nothing usable, so a caller can skip
 * rendering a link instead of producing a dead "https://www.instagram.com/"
 * button for an env var that was never set.
 */
export function socialUrl(network, value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const known = ['instagram', 'tiktok', 'whatsapp', 'facebook']

  // Already a full URL: pass it through, but only for a network we recognise, so
  // a bad value cannot turn into an arbitrary link in the footer.
  if (/^https?:\/\//i.test(raw)) return known.includes(network) ? raw : ''

  // `javascript:` and `data:` are deliberately not treated as URLs: a config
  // value is not trusted to be a URL just because it has a colon.
  if (raw.includes(':')) return ''

  if (network === 'whatsapp') {
    // wa.me takes digits only, so a number pasted as "+212 773 214 703" gets
    // the same treatment as the bare one. A value with no digits at all is a
    // handle, not a number, so it is rejected rather than sent to wa.me.
    const digits = raw.replace(/\D+/g, '')
    return digits ? `https://wa.me/${digits}` : ''
  }

  if (!known.includes(network)) return ''

  const handle = raw.replace(/^@+/, '').replace(/\/+$/, '')
  if (!handle) return ''

  if (network === 'instagram') return `https://www.instagram.com/${handle}/`
  if (network === 'tiktok') return `https://www.tiktok.com/@${handle}`
  return `https://www.facebook.com/${handle}`
}

export function imageUrl(url) {
  if (!url) return null

  if (/^https?:\/\//i.test(url)) {
    if (!ORIGIN) {
      // Same-origin: strip the API origin so /images/... is used here.
      try {
        return new URL(url).pathname
      } catch {
        return url
      }
    }

    return url
  }

  // Media owned by the API, handed out either as `images/products/x.svg` or as
  // the bare `products/x.svg` stored in the database.
  if (url.startsWith('/images/')) return `${ORIGIN}${url}`
  if (!url.startsWith('/')) return `${ORIGIN}/images/${url}`

  // Anything else root relative (the bank slip) ships with the storefront.
  return url
}
