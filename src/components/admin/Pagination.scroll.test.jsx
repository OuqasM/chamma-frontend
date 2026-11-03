// @vitest-environment jsdom
/**
 * The admin paginator starts the new page at the top.
 *
 * The browser keeps the offset it had, so a page change that did not ask for
 * a scroll left the owner reading the bottom of the list they had just left,
 * with the rows they wanted above the fold. jsdom has no layout, so the
 * position cannot be asserted; what is asserted is who asks the window to
 * scroll, on which user action, with what options.
 *
 * The scroll belongs to the paginator and not to each list: the admin's page
 * number is plain component state behind a debounced request, so there is no
 * query-string write to watch the way the storefront's `Catalogue` does.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { Pagination } = await import('./Ui')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const meta = {
  links: [
    { url: null, label: '&laquo; Previous', active: false },
    { url: 'https://api.chammastore.com/api/fr/admin/orders?page=1', label: '1', active: true },
    { url: 'https://api.chammastore.com/api/fr/admin/orders?page=2', label: '2', active: false },
    { url: 'https://api.chammastore.com/api/fr/admin/orders?page=2', label: 'Next &raquo;', active: false },
  ],
}

let container
let root
let scrollTo
let onPage

beforeEach(() => {
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  onPage = vi.fn()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  scrollTo.mockRestore()
})

const render = async () => {
  await act(async () => {
    root.render(<Pagination meta={meta} onPage={onPage} />)
  })
}

/** The button for a page number, skipping the disabled current page. */
const pageButton = (label) =>
  [...container.querySelectorAll('nav[aria-label="Pagination"] button')].find(
    (b) => b.textContent.trim() === label && !b.disabled,
  )

describe('the admin paginator', () => {
  it('does not scroll when the list is drawn — only when the page changes', async () => {
    await render()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('starts the new page at the top', async () => {
    await render()
    scrollTo.mockClear()

    await act(async () => pageButton('2').click())

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })

  it('asks the list for the page the link names', async () => {
    await render()

    await act(async () => pageButton('2').click())

    // The page number is read out of the API's own link URL: the panel and the
    // API are two hosts and the URLs do not match.
    expect(onPage).toHaveBeenCalledWith('2')
  })

  it('leaves the page alone where the owner already is', async () => {
    await render()
    scrollTo.mockClear()

    // The current page is drawn as a disabled button: it is where the owner
    // already is, and clicking it must not be a trip anywhere.
    const current = container.querySelector('nav[aria-label="Pagination"] button')
    expect(current.disabled).toBe(true)
    expect(current.textContent.trim()).toBe('1')

    await act(async () => current.click())

    expect(scrollTo).not.toHaveBeenCalled()
    expect(onPage).not.toHaveBeenCalled()
  })
})
