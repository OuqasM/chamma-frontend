/**
 * The two request-sharing rules in the client: checkout options are shared
 * and briefly cached, and an identical live quote is shared while in flight.
 *
 * Both exist for the same reason, and it is worth restressing them together:
 * the checkout form is mounted twice — `CartDrawer` keeps it alive after the
 * first add-to-cart, and `/{locale}/checkout` mounts it again on the page —
 * so two instances of `useCheckoutForm` can be alive at once, asking for the
 * same city list and the same quote. Without these rules the shopper pays
 * four round trips instead of two.
 *
 * The line both rules respect: options are shop configuration (cacheable),
 * quotes are priced from live stock (never reused once settled).
 *
 * `vi.resetModules()` in `beforeEach` is not decoration — the caches are
 * module-private Maps, so a fresh module instance per test is the only way a
 * test can start from an empty cache.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let fetchMock

const ok = (body) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
})

const fail = (body, status) => ({
  ok: false,
  status,
  text: async () => JSON.stringify(body),
})

// Bodies spelled with matching key order in every test: the quote key is
// `JSON.stringify([locale, body])`, so two semantically identical payloads
// must also be textually identical, or one would share the other's request.
const quoteBody = () => ({ city: 'CASABLANCA', items: [{ product_id: 1, quantity: 2 }] })

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('checkout options', () => {
  it('answers two concurrent calls with one request', async () => {
    const { api } = await import('./api')
    fetchMock.mockResolvedValue(ok({ cities: [] }))

    const [a, b] = await Promise.all([api.checkoutOptions('fr'), api.checkoutOptions('fr')])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
  })

  it('reuses a settled answer within the TTL', async () => {
    const { api } = await import('./api')
    fetchMock.mockResolvedValue(ok({ cities: [] }))

    await api.checkoutOptions('fr')
    await api.checkoutOptions('fr')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caches per locale', async () => {
    const { api } = await import('./api')
    fetchMock.mockResolvedValue(ok({ cities: [] }))

    await api.checkoutOptions('fr')
    await api.checkoutOptions('ar')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/fr/checkout/options', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/ar/checkout/options', expect.anything())
  })

  it('refetches once the TTL has passed', async () => {
    const { api } = await import('./api')
    fetchMock.mockResolvedValue(ok({ cities: [] }))

    const started = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(started)
    await api.checkoutOptions('fr')

    // One millisecond past the five minutes: the boundary has to expire.
    clock.mockReturnValue(started + 5 * 60 * 1000 + 1)
    await api.checkoutOptions('fr')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('never caches a failure, so a retry is a real retry', async () => {
    const { api } = await import('./api')
    fetchMock.mockResolvedValueOnce(fail({ message: 'gateway error' }, 502))
    fetchMock.mockResolvedValue(ok({ cities: [] }))

    await expect(api.checkoutOptions('fr')).rejects.toMatchObject({ status: 502 })
    await api.checkoutOptions('fr')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('the live quote', () => {
  it('answers two identical in-flight quotes with one request', async () => {
    const { api } = await import('./api')

    // Held open so both callers are waiting on it at the same time: this is
    // the drawer-and-page moment the sharing exists for.
    let release
    fetchMock.mockImplementation(() => new Promise((resolve) => { release = resolve }))

    const first = api.quote('fr', quoteBody())
    const second = api.quote('fr', quoteBody())
    release(ok({ shipping_cost: 35, total: 5035 }))

    const [a, b] = await Promise.all([first, second])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
  })

  it('asks again once the first quote has settled, even for the same cart', async () => {
    const { api } = await import('./api')
    fetchMock.mockResolvedValue(ok({ total: 1000 }))

    await api.quote('fr', quoteBody())
    await api.quote('fr', quoteBody())

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not share a quote whose cart differs', async () => {
    const { api } = await import('./api')
    fetchMock.mockResolvedValue(ok({ total: 1000 }))

    const other = { city: 'CASABLANCA', items: [{ product_id: 2, quantity: 1 }] }
    await Promise.all([api.quote('fr', quoteBody()), api.quote('fr', other)])

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
