/**
 * Waitlist form regression tests.
 *
 * A product page renders this form, and a related product's card dialog renders
 * it again at the same time. Both bugs caught here were DOM-level and invisible
 * in a screenshot: one form's input was receiving the other's text.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    locale: 'fr',
    t: (_group, key) => key,
  }),
}))

vi.mock('../lib/api', () => ({ api: { joinWaitlist: () => Promise.resolve({}) } }))

const WaitlistForm = (await import('./WaitlistForm')).default

/** All input ids in a rendered fragment. */
const inputIds = (markup) => [...markup.matchAll(/<input[^>]*\sid="([^"]+)"/g)].map((m) => m[1])

/** The label/control pairings, i.e. which input each label actually names. */
const labelTargets = (markup) => [...markup.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((m) => m[1])

describe('WaitlistForm', () => {
  it('gives each rendered form its own input ids', () => {
    // This is the regression. A fixed id meant a card dialog opened over a
    // product page shipped two elements with the same id, so the dialog's label
    // pointed at the page's input and typing in the dialog filled in the form
    // behind it. Two fields per form makes it four ids to keep apart, which is
    // exactly the case a single shared id would get wrong twice.
    const product = { id: 1, slug: 'oud' }
    const markup = renderToStaticMarkup(
      <div>
        <WaitlistForm product={product} />
        <WaitlistForm product={product} />
      </div>,
    )

    const ids = inputIds(markup)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
  })

  it('points every label at an input that exists in the same tree', () => {
    const product = { id: 1, slug: 'oud' }
    const markup = renderToStaticMarkup(
      <div>
        <WaitlistForm product={product} />
        <WaitlistForm product={product} />
      </div>,
    )

    const ids = new Set(inputIds(markup))
    for (const target of labelTargets(markup)) {
      expect(ids).toContain(target)
    }
    // Two labels per form: the name and the phone.
    expect(labelTargets(markup)).toHaveLength(4)
  })

  it('asks for a name as well as a number', () => {
    // The name is required, so the browser enforces it without a round trip and
    // the customer is told up front why the store wants it.
    const markup = renderToStaticMarkup(<WaitlistForm product={{ id: 1, slug: 'oud' }} />)

    expect(markup).toContain('waitlistNameHint')
    expect(markup).toContain('waitlistPhoneHint')
    // Both inputs carry `required`; the static markup spells the attribute bare.
    expect(markup.match(/required/g)).toHaveLength(2)
    // Name autocomplete, so a returning customer is not retyping what the
    // browser already knows.
    expect(markup).toContain('autoComplete="name"')
  })

  it('keeps the title and intro on the product page', () => {
    const markup = renderToStaticMarkup(<WaitlistForm product={{ id: 1, slug: 'oud' }} />)
    expect(markup).toContain('waitlistTitle')
    expect(markup).toContain('waitlistIntro')
  })

  it('drops them in the dialog, which supplies its own heading', () => {
    // Otherwise the dialog repeats the same sentence twice in a 24rem box.
    const markup = renderToStaticMarkup(<WaitlistForm product={{ id: 1, slug: 'oud' }} compact />)
    expect(markup).not.toContain('waitlistTitle')
    expect(markup).not.toContain('waitlistIntro')
    expect(markup).toContain('waitlistPhoneHint')
  })

  it('keeps the consent line in the compact form', () => {
    // The dialog is a consent surface too. A phone field with no explanation of
    // what the number is for is how a shop ends up on a list it never agreed to.
    const markup = renderToStaticMarkup(<WaitlistForm product={{ id: 1, slug: 'oud' }} compact />)
    expect(markup).toContain('waitlistConsent')
  })

  it('uses a telephone field so a phone keyboard is offered', () => {
    const markup = renderToStaticMarkup(<WaitlistForm product={{ id: 1, slug: 'oud' }} compact />)
    expect(markup).toContain('type="tel"')
    // React's static markup keeps the camelCase spelling; the real DOM
    // lowercases it to the `inputmode` attribute the spec defines.
    expect(markup).toContain('inputMode="tel"')
    // Digits stay left-to-right even on the Arabic page.
    expect(markup).toContain('dir="ltr"')
  })
})