// @vitest-environment jsdom
/**
 * Product description: the language buttons, and which one is preselected.
 *
 * Rendered into a real DOM because the behaviour worth protecting is
 * substitution and selection, not presence. An earlier version appended a
 * second copy of the description below the fold, which every presence-only
 * assertion would have passed: two descriptions rendered, and the shopper was
 * left reading one that was no longer under its own heading.
 *
 * The preselection is the subtle half. The API flags `is_current` on the
 * language whose copy the page is actually showing, and that is not always the
 * language in the URL — the page's description resolves through a fallback
 * chain, so an Arabic URL for a product written only in French is displaying
 * French copy. Preselecting from the URL instead would label a French
 * paragraph as the store's own Arabic writing.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ t: (_group, key) => key }),
}))

const { default: ProductDescription } = await import('./ProductDescription')

// A French page for a product written in all three languages.
const written = (current = 'fr') => [
  { locale: 'fr', name: 'Français', dir: 'ltr', description: 'Un parfum oriental', description_html: '<p>Un parfum oriental</p>', is_current: current === 'fr' },
  { locale: 'ar', name: 'العربية', dir: 'rtl', description: 'عطر شرقي', description_html: '<p>عطر شرقي</p>', is_current: current === 'ar' },
  { locale: 'en', name: 'English', dir: 'ltr', description: 'An oriental perfume', description_html: '<p>An oriental perfume</p>', is_current: current === 'en' },
]

let container
let root

const mount = async (translations = written()) => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(<ProductDescription translations={translations} />)
  })
}

const body = () => container.querySelector('#product-description-body')
const buttons = () => [...container.querySelectorAll('button[aria-pressed]')]
const pressed = () => buttons().find((b) => b.getAttribute('aria-pressed') === 'true')

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
})

describe('ProductDescription', () => {
  it('preselects the language the API says is showing', async () => {
    await mount()

    expect(pressed().textContent).toBe('Français')
    expect(body().textContent).toContain('Un parfum oriental')
  })

  it('preselects from the flag, not from the first language in the list', async () => {
    // The whole point of the flag. The list is in locale-table order, so
    // "first entry" and "the language being shown" disagree the moment the
    // showing language is not French — which is most of the time, on an Arabic
    // or English page. Both assertions below put the current language *second*,
    // because with it first a component reading `translations[0]` would produce
    // the right answer by accident and the test would prove nothing.
    //
    // An Arabic page for a product genuinely written in Arabic.
    await mount(written('ar'))

    expect(pressed().textContent).toBe('العربية')
    expect(body().textContent).toContain('عطر شرقي')

    // The fallback case: an Arabic page for a product written only in French is
    // displaying French copy, so French is what must be preselected. Only two
    // entries, because only two were written.
    await mount([{ ...written()[0], is_current: true }, { ...written()[1], is_current: false }])

    expect(pressed().textContent).toBe('Français')
    expect(body().textContent).toContain('Un parfum oriental')
    expect(buttons().map((b) => b.textContent)).toEqual(['Français', 'العربية'])
  })

  it('offers a button for the language the page is already in, so there is a way back', async () => {
    await mount()

    // Three written languages, three buttons. Only offering the other two would
    // leave the shopper on the page's own copy with no button marked, and no
    // control to return to once they had switched away.
    expect(buttons().map((b) => b.textContent)).toEqual(['Français', 'العربية', 'English'])
  })

  it('replaces the description rather than adding a second one', async () => {
    await mount()

    // Asserted against the whole container, not against `#product-description-body`.
    // Keying on the region id was the first attempt here and it passed against
    // the old append-at-the-bottom design, because that design still rendered
    // exactly one element with that id — holding only the translation, with the
    // original sitting unlabelled above it. Counting the rendered description
    // blocks is what actually distinguishes swapping from appending.
    const countDescriptions = () =>
      container.querySelectorAll('.rich-text, #product-description-body > p').length

    expect(countDescriptions()).toBe(1)

    await act(async () => buttons()[1].click())

    expect(body().textContent).toContain('عطر شرقي')
    // Nowhere on the page, not merely absent from the region: the shopper was
    // left reading a copy that was no longer under its own heading.
    expect(container.textContent).not.toContain('Un parfum oriental')
    expect(countDescriptions()).toBe(1)
  })

  it('puts the preselected description back when its button is pressed', async () => {
    // The only way out for a shopper who cannot read the language they tapped.
    await mount()

    await act(async () => buttons()[1].click())
    expect(pressed().textContent).toBe('العربية')

    await act(async () => buttons()[1].click())

    expect(pressed().textContent).toBe('Français')
    expect(body().textContent).toContain('Un parfum oriental')
  })

  it('switches straight from one language to the next', async () => {
    await mount()

    await act(async () => buttons()[1].click())
    await act(async () => buttons()[2].click())

    expect(body().textContent).toContain('An oriental perfume')
    expect(body().textContent).not.toContain('عطر شرقي')
    expect(pressed().textContent).toBe('English')
  })

  it('keeps exactly one button pressed at a time', async () => {
    await mount()
    await act(async () => buttons()[1].click())

    expect(buttons().filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
  })

  it('sets the direction on the body, not only on the button', async () => {
    // Arabic text left-aligned inside an LTR page puts its punctuation and its
    // brackets on the wrong side, which is the giveaway that the copy was not
    // written for the reader rather than merely untranslated.
    await mount()
    expect(body().getAttribute('dir')).toBe('ltr')

    await act(async () => buttons()[1].click())
    expect(body().getAttribute('dir')).toBe('rtl')

    await act(async () => buttons()[2].click())
    expect(body().getAttribute('dir')).toBe('ltr')
  })

  it('takes the direction from the language showing, not from the page locale', async () => {
    // A French page displaying Arabic copy has to be set right to left, or the
    // paragraph is misaligned in the one place the shopper can least afford it.
    await mount([{ ...written()[0], is_current: false }, { ...written()[1], is_current: true }])

    expect(pressed().textContent).toBe('العربية')
    expect(body().getAttribute('dir')).toBe('rtl')
  })

  it('uses aria-pressed, because nothing is being disclosed', async () => {
    // aria-expanded would tell a screen reader there is a panel to navigate to,
    // and there is none — the same region is showing different content.
    await mount()

    expect(buttons().every((b) => b.hasAttribute('aria-pressed'))).toBe(true)
    expect(buttons().every((b) => !b.hasAttribute('aria-expanded'))).toBe(true)
  })

  it('renders the buttons on the heading row, not in a panel of their own', async () => {
    await mount()

    // Plain `contains`, since there is no jest-dom in this project. The
    // assertion is that the buttons are a sibling of the heading — the shape
    // that puts them on the same line, above the one description.
    const row = container.querySelector('h2').parentElement

    expect(row.contains(buttons()[0])).toBe(true)
    expect(row.contains(body())).toBe(false)
  })

  it('sets the buttons heavier than the heading they sit beside', async () => {
    // "More visible" is the requirement, and it is easy to satisfy by accident
    // now and lose quietly later: shrink one of these numbers and the DOM is
    // still correct, every other test here still passes, and the control goes
    // back to reading as part of its own label. At 11px in `stone-600` on a
    // `stone-200` border it was within a hair of the 12px grey heading beside
    // it, which is what prompted the change.
    await mount()

    // A *resting* button. `buttons()[0]` is the preselected one now that the
    // current language has a button, and it carries the active classes instead.
    const resting = buttons().find((b) => b.getAttribute('aria-pressed') === 'false')
    const cls = resting.className
    const heading = container.querySelector('h2').className

    // Tailwind's named steps, so this reads the same as the class a reader
    // would look for. An arbitrary value is matched directly, since that is
    // how the heading is currently set.
    const STEPS = { 'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20 }
    const size = (c) => {
      const named = Object.entries(STEPS).find(([token]) => c.includes(token))
      if (named) return named[1]
      return Number(c.match(/text-\[(\d+)px\]/)?.[1] ?? 0)
    }

    expect(size(cls)).toBeGreaterThan(size(heading))
    // Semibold, not medium: the weight is what separates a control from a
    // label at this size far more reliably than the size is.
    expect(cls).toContain('font-semibold')
    expect(cls).not.toContain('font-medium')
    // The resting border, and a fill for the state. A 1px rule is the only thing
    // saying "button" here, since the label is just a language name.
    expect(cls).toContain('border-stone-400')
  })

  it('gives the preselected button a solid fill rather than a tint', async () => {
    await mount()

    const cls = pressed().className

    // `bg-gold` at full strength, and explicitly not the `/10` wash used
    // elsewhere in the UI for a selected *row*. On arrival the shopper has to be
    // able to see which language they are reading without pressing anything.
    expect(cls).toContain('bg-gold')
    expect(cls).not.toContain('bg-gold/')
  })

  it('renders no buttons at all when nothing has been written in any language', async () => {
    // A control that switches between nothing and nothing is worse than no
    // control: it advertises a choice the store cannot honour.
    await mount([])

    expect(container.innerHTML).toBe('')
  })

  it('renders something even if the API sends no is_current flag', async () => {
    // The frontend can be deployed ahead of the backend. A response from the
    // previous resource has no `is_current` at all, and preselecting nothing
    // would leave the shopper staring at a heading with no paragraph under it.
    await mount(written().map(({ is_current, ...entry }) => entry))

    expect(pressed().textContent).toBe('Français')
    expect(body().textContent).toContain('Un parfum oriental')
  })

  it('falls back to plain text when a language has no rendered HTML', async () => {
    await mount([{ ...written()[0], description_html: '' }])

    expect(body().textContent).toBe('Un parfum oriental')
    expect(body().querySelector('p')).toBeTruthy()
  })
})
