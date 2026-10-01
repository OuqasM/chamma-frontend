// @vitest-environment jsdom
/**
 * Reading a product description in another language.
 *
 * The whole feature is a promise that what appears under an Arabic or English
 * button was written in that language. The API guarantees that by withholding
 * untranslated languages, so what is worth pinning here is the other half: that
 * the component never manufactures an entry, and that a language is labelled in
 * its own script so a shopper who cannot read the page can still find it.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'fr',
    // Echoes the key so assertions read as names, and interpolates {language}
    // the way the real translator does.
    t: (_group, key, vars) => (vars ? `${key}:${vars.language}` : key),
  }),
}))

const { default: TranslatedDescription } = await import('./TranslatedDescription')

const arabic = { locale: 'ar', name: 'العربية', dir: 'rtl', description: 'عود ملكي.', description_html: '<p>عود ملكي.</p>' }
const english = { locale: 'en', name: 'English', dir: 'ltr', description: 'A deep oud.', description_html: '<p>A deep oud.</p>' }

const mount = (translations) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(<TranslatedDescription translations={translations} />))

  // Scoped to the language buttons: once a panel is open there is also a
  // "back to the description" button in the tree, and it is not a language.
  const buttons = () => [...host.querySelectorAll('button[aria-controls]')]
  const panel = () => host.querySelector('#translated-description')

  return {
    host,
    buttons,
    panel,
    click: (label) =>
      act(() => {
        buttons().find((b) => b.textContent.trim() === label)?.click()
      }),
    unmount: () => act(() => root.unmount()),
  }
}

describe('TranslatedDescription', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('offers nothing when no language has a description', () => {
    // The API sends an empty list for an untranslated product. Rendering a
    // control anyway would open onto a panel with nothing in it.
    const { host } = mount([])

    expect(host.textContent).toBe('')
    expect(host.querySelector('button')).toBeNull()
  })

  it('offers nothing when given no list at all', () => {
    const { host } = mount(undefined)

    expect(host.querySelector('button')).toBeNull()
  })

  it('shows a button per language, named in that language', () => {
    // Not "Français" beside a French paragraph: a shopper who cannot read the
    // page may not read its alphabet, and the native name is the one label
    // that helps them.
    const { buttons } = mount([arabic, english])

    expect(buttons().map((b) => b.textContent.trim())).toEqual(['العربية', 'English'])
  })

  it('keeps the description closed until a language is chosen', () => {
    // A page that unfolds every translation at once is a wall of repeated prose.
    const { panel } = mount([arabic, english])

    expect(panel()).toBeNull()
  })

  it('reveals the description in the language that was chosen', () => {
    const { buttons, click, panel } = mount([arabic, english])

    click('English')

    expect(panel().textContent).toContain('A deep oud.')
    expect(panel().textContent).not.toContain('عود ملكي.')
  })

  it('closes again when the same language is chosen twice', () => {
    const { click, panel } = mount([arabic, english])

    click('English')
    expect(panel()).not.toBeNull()

    click('English')
    expect(panel()).toBeNull()
  })

  it('switches directly between languages', () => {
    const { click, panel } = mount([arabic, english])

    click('العربية')
    expect(panel().textContent).toContain('عود ملكي.')

    click('English')
    expect(panel().textContent).toContain('A deep oud.')
    expect(panel().textContent).not.toContain('عود ملكي.')
  })

  it('sets the writing direction of the revealed text', () => {
    // Without dir=rtl the paragraph renders left-aligned with its punctuation
    // and sentence order backwards. The direction is on the section that wraps
    // the text, not on the panel, because the panel also holds the heading and
    // the close button, which stay in the page's own direction.
    const { click } = mount([arabic, english])

    click('العربية')
    expect(document.querySelector('#translated-description section').getAttribute('dir')).toBe('rtl')

    click('English')
    expect(document.querySelector('#translated-description section').getAttribute('dir')).toBe('ltr')
  })

  it('renders markdown as html, falling back to plain text when there is none', () => {
    const { click, panel } = mount([{ ...arabic, description_html: '' }])

    click('العربية')

    expect(panel().textContent).toContain('عود ملكي.')
    expect(panel().querySelector('.rich-text')).toBeNull()
  })

  it('marks each button as expanded only while its panel is showing', () => {
    const { buttons, click } = mount([arabic, english])

    expect(buttons().map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false'])

    click('English')
    expect(buttons().map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'true'])
  })

  it('points every button at the panel it controls', () => {
    const { buttons } = mount([arabic, english])

    for (const button of buttons()) {
      expect(button.getAttribute('aria-controls')).toBe('translated-description')
    }
  })

  it('names the language in the panel heading as well', () => {
    const { click, panel } = mount([arabic, english])

    click('العربية')

    expect(panel().querySelector('h3').textContent).toContain('العربية')
  })
})
