// @vitest-environment jsdom
/**
 * Admin: the visits table is one row per IP address, not per visitor.
 *
 * The server used to return one row per `visitor_id`, which read as "we had
 * twelve visitors this morning" when most of those rows were the same household
 * behind the same address, or the same person who cleared their cookie. The
 * list now collapses to one row per address and carries the people behind it in
 * a `visitors` count, so the two numbers can be compared.
 *
 * The value of asserting the *columns* is that the old shape and the new one
 * fail in opposite directions. Left rendering `v.path` or `v.visitor_id` against
 * the grouped payload, React does not throw — the field is simply `undefined` and
 * the cell goes blank. A blank cell is invisible in review and looks like a bug
 * report from the owner weeks later. Pinning the header row makes the change
 * visible in a diff and fails loudly if a column comes back.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const visits = vi.fn()

// Hoisted, so `t` is the same function on every render and the effect that
// depends on it does not re-fire on every setState.
const t = (_group, key) => key

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call: (fn) => fn(new AbortController().signal) }),
}))

vi.mock('../../lib/api', () => ({ adminApi: { visits } }))

const AdminVisits = (await import('./Visits')).default

/** Two addresses. The first is three people and fourteen page views. */
const payload = () => ({
  visits: [
    {
      ip: '41.140.12.9',
      device: 'desktop',
      browser: 'Chrome',
      visitors: 3,
      visits_count: 14,
      last_seen: '2026-09-30T10:00:00+00:00',
    },
    {
      ip: '41.140.99.4',
      device: 'mobile',
      browser: 'Safari',
      visitors: 1,
      visits_count: 2,
      last_seen: '2026-09-30T08:00:00+00:00',
    },
  ],
  meta: {},
  summary: {
    total: 2,
    visitors: 4,
    page_views: 16,
    last_24h: 2,
    last_30d: 2,
    by_device: { desktop: 1, mobile: 1 },
    top_paths: [],
  },
  filters: { devices: ['desktop', 'mobile'] },
})

let container
let root

const render = async () => {
  await act(async () => {
    root.render(<AdminVisits />)
  })
  // The page debounces its fetch by 250ms; without this the assertions read the
  // empty state and the test passes for the wrong reason.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300))
  })
}

const head = () => [...container.querySelectorAll('thead th')].map((th) => th.textContent.trim())

/** One body row as a plain object, so assertions read like the data. */
const row = (index) => {
  const cells = [...container.querySelectorAll('tbody tr')[index].querySelectorAll('td')]
  return cells.map((td) => td.textContent.trim())
}

/** The four stat tiles, as label → number. */
const stats = () => {
  const tiles = [...container.querySelectorAll('.grid > div')]
  return Object.fromEntries(
    tiles.map((tile) => [
      tile.querySelector('p').textContent.trim(),
      tile.querySelectorAll('p')[1].textContent.trim(),
    ]),
  )
}

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
})

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  visits.mockClear()
  visits.mockResolvedValue(payload())
})

describe('AdminVisits grouped by address', () => {
  it('lists one row per address, with the people behind it', async () => {
    await render()

    expect(head()).toEqual(['ipAddress', 'device', 'browser', 'visitors', 'visitsCount', 'lastSeen'])

    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
    // The address, then the two counts that differ: three people, fourteen pages.
    expect(row(0)).toEqual(['41.140.12.9', 'device_desktop', 'Chrome', '3', '14', expect.any(String)])
  })

  it('reports addresses and visitors as two different numbers', async () => {
    await render()

    // Five addresses, six people: the gap between them is the NAT effect, and
    // collapsing it into a single "visitors" figure is what made the old table
    // read as more traffic than the store had.
    expect(stats()).toMatchObject({ visitors: '4', addresses: '2', pageViews: '16', visitorsLast24h: '2' })
  })

  it('never renders the per-visitor fields the grouped payload dropped', async () => {
    await render()

    const text = container.textContent
    // `visitor_id` was a tracking token; `path`, `os` and `first_seen` no longer
    // exist on a row that stands for several visits. Any of them reappearing
    // means the page and the endpoint have drifted apart again.
    expect(text).not.toContain('visitor_id')
    expect(text).not.toContain('firstSeen')
    expect(text).not.toContain('visitor:')
  })
})
