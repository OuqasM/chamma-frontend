// @vitest-environment jsdom
/**
 * The product page's multi-select variant picker.
 *
 * The behaviour worth pinning is the one the single-choice select could not do:
 * choosing a second variant adds to the selection instead of replacing it, and
 * the panel stays open between choices. Dismissal is checked through the
 * trigger's `aria-expanded`, since the panel itself lingers for the length of
 * its fade-out before unmounting.
 */
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'fr',
    t: (_group, key) => ({
      selectVariants: 'Sélectionner les variantes',
      variantsHint: 'Sélectionnez une ou plusieurs variantes.',
    })[key] ?? key,
  }),
}))

const { default: VariantPicker } = await import('./VariantPicker')

const VARIANTS = [
  { id: 1, name: '50ml' },
  { id: 2, name: '100ml' },
  { id: 3, name: '200ml' },
]

function Harness() {
  const [value, setValue] = useState([])
  return <VariantPicker variants={VARIANTS} value={value} onChange={setValue} />
}

let container
let root

const trigger = () => container.querySelector('[aria-haspopup="listbox"]')
const options = () => [...container.querySelectorAll('[role="option"]')]

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

const render = async () => {
  await act(async () => root.render(<Harness />))
}

describe('VariantPicker', () => {
  it('shows a placeholder and no list until it is opened', async () => {
    await render()

    expect(trigger().textContent).toContain('Sélectionner les variantes')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(options()).toHaveLength(0)
  })

  it('adds each chosen variant to the selection without closing', async () => {
    await render()

    await act(async () => trigger().click())
    expect(options()).toHaveLength(3)

    await act(async () => options()[0].click())
    await act(async () => options()[1].click())

    // Both are kept, rather than the second replacing the first.
    expect(trigger().textContent).toContain('50ml, 100ml')
    // And the panel is still open to choose another.
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(options()).toHaveLength(3)
  })

  it('removes a chosen variant when it is clicked again', async () => {
    await render()

    await act(async () => trigger().click())
    await act(async () => options()[0].click())
    await act(async () => options()[1].click())
    await act(async () => options()[0].click())

    expect(trigger().textContent).toContain('100ml')
    expect(trigger().textContent).not.toContain('50ml')
  })

  it('closes on Escape', async () => {
    await render()

    await act(async () => trigger().click())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on a press outside it', async () => {
    await render()

    await act(async () => trigger().click())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })

    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })
})
