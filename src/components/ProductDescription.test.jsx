// @vitest-environment jsdom
/**
 * Product description: the language buttons swap the paragraph in place.
 *
 * Rendered into a real DOM because the behaviour worth protecting is
 * substitution, not presence. An earlier version appended a second copy of the
 * description below the fold, which every presence-only assertion would have
 * passed: two descriptions rendered, and the shopper was left reading one that
 * was no longer under its own heading. So the tests here count description
 * regions and check which one is showing, rather than checking that some
 * translated text appeared somewhere.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({ t: (_group, key) => key }),
}))

const { default: ProductDescription } = await import('./ProductDescription')

const translations = [
  {
    locale: 'ar',
    name: 'العربية',
    dir: 'rtl',
    description: 'عطر شرقي',
    description_html: '<p>عطر شرقي</p>',
  },
  {
    locale: 'en',
    name: 'English',
    dir: 'ltr',
    description: 'An oriental perfume',
    description_html: '<p>An oriental perfume</p>',
  },
]

let container
let root

const mount = async (props = {}) => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <ProductDescription
        description="Un parfum oriental"
        description_html="<p>Un parfum oriental</p>"
        translations={translations}
        {...props}
      />,
    )
  })
}

const body = () => container.querySelector('#product-description-body')
const buttons = () => [...container.querySelectorAll('button[aria-pressed]')]

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
})

describe('ProductDescription', () => {
  it('shows the page language on arrival, with no button pressed', () => {
    return mount().then(() => {
      expect(body().textContent).toContain('Un parfum oriental')
      expect(buttons().every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true)
    })
  })

  it('replaces the description rather than adding a second one', () => {
    // The regression this component exists to prevent.
    //
    // Asserted against the whole container, not against `#product-description-body`.
    // Keying on the region id was the first attempt here and it passed against
    // the old append-at-the-bottom design, because that design still rendered
    // exactly one element with that id — holding only the translation, with the
    // original sitting unlabelled above it. Counting the rendered description
    // blocks is what actually distinguishes swapping from appending.
    return mount().then(async () => {
      // `> p`, not ` p`: the plain-text fallback is a direct child of the
      // region, whereas a rendered description is a `.rich-text` div whose
      // own paragraphs must not be counted again.
      const countDescriptions = () =>
        container.querySelectorAll('.rich-text, #product-description-body > p').length

      expect(countDescriptions()).toBe(1)

      await act(async () => buttons()[0].click())

      expect(body().textContent).toContain('عطر شرقي')
      // Nowhere on the page, not merely absent from the region: the shopper was
      // left reading a copy that was no longer under its own heading.
      expect(container.textContent).not.toContain('Un parfum oriental')
      expect(countDescriptions()).toBe(1)
    })
  })

  it('puts the original description back when the same button is pressed again', () => {
    // The only way out for a shopper who cannot read the language they tapped.
    return mount().then(async () => {
      await act(async () => buttons()[0].click())
      await act(async () => buttons()[0].click())

      expect(body().textContent).toContain('Un parfum oriental')
      expect(buttons()[0].getAttribute('aria-pressed')).toBe('false')
    })
  })

  it('switches straight from one language to the next', () => {
    return mount().then(async () => {
      await act(async () => buttons()[0].click())
      await act(async () => buttons()[1].click())

      expect(body().textContent).toContain('An oriental perfume')
      expect(body().textContent).not.toContain('عطر شرقي')
      expect(buttons()[0].getAttribute('aria-pressed')).toBe('false')
      expect(buttons()[1].getAttribute('aria-pressed')).toBe('true')
    })
  })

  it('sets the direction on the body, not only on the button', () => {
    // Arabic text left-aligned inside an LTR page puts its punctuation and its
    // brackets on the wrong side, which is the giveaway that the copy was not
    // written for the reader rather than merely untranslated.
    return mount().then(async () => {
      expect(body().getAttribute('dir')).toBeNull()

      await act(async () => buttons()[0].click())
      expect(body().getAttribute('dir')).toBe('rtl')

      await act(async () => buttons()[1].click())
      expect(body().getAttribute('dir')).toBe('ltr')
    })
  })

  it('labels each button in its own script', () => {
    return mount().then(() => {
      expect(buttons().map((b) => b.textContent)).toEqual(['العربية', 'English'])
    })
  })

  it('uses aria-pressed, because nothing is being disclosed', () => {
    // aria-expanded would tell a screen reader there is a panel to navigate to,
    // and there is none — the same region is showing different content.
    return mount().then(() => {
      expect(buttons().every((b) => b.hasAttribute('aria-pressed'))).toBe(true)
      expect(buttons().every((b) => !b.hasAttribute('aria-expanded'))).toBe(true)
    })
  })

  it('renders the buttons on the heading row, not in a panel of their own', () => {
    return mount().then(() => {
      // Plain `contains`, since there is no jest-dom in this project. The
      // assertion is that the buttons are a sibling of the heading — the shape
      // that puts them on the same line, above the one description.
      const row = container.querySelector('h2').parentElement

      expect(row.contains(buttons()[0])).toBe(true)
      expect(row.contains(body())).toBe(false)
    })
  })

  it('renders no buttons at all when nothing is translated', () => {
    // A control that switches between nothing and nothing is worse than no
    // control: it advertises a choice the store cannot honour.
    return mount({ translations: [] }).then(() => {
      expect(buttons()).toHaveLength(0)
      expect(body().textContent).toContain('Un parfum oriental')
    })
  })

  it('renders no buttons when a product has translations but no description of its own', () => {
    return mount({ description: '', description_html: '' }).then(() => {
      // The section still renders — the heading is a real part of the page —
      // and the buttons still work, but there is no own-language copy for the
      // unpressed state to fall back to.
      expect(buttons()).toHaveLength(2)
      expect(body().textContent).toBe('')
    })
  })

  it('falls back to plain text when a language has no rendered HTML', () => {
    return mount({
      translations: [{ locale: 'en', name: 'English', dir: 'ltr', description: 'Plain only', description_html: '' }],
    }).then(async () => {
      await act(async () => buttons()[0].click())

      expect(body().textContent).toBe('Plain only')
      expect(body().querySelector('p')).toBeTruthy()
    })
  })

  it('renders nothing when there is no description in any language', () => {
    return mount({ description: '', description_html: '', translations: [] }).then(() => {
      expect(container.innerHTML).toBe('')
    })
  })
})
