// @vitest-environment jsdom
/**
 * Admin: one file picker, several photos.
 *
 * A product is shot from several angles, and uploading them one at a time was
 * the slowest part of adding a perfume. The picker now takes the whole
 * selection at once — but the gallery still holds eight, so the extra files
 * must not be sent to the server only to be dropped by the form.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const upload = vi.fn()

const t = (_group, key) => key
const call = (fn) => fn(new AbortController().signal)

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call }),
}))

vi.mock('../../lib/api', () => ({
  adminApi: {
    brands: () => Promise.resolve({ data: [] }),
    categories: () => Promise.resolve({ data: [] }),
    upload,
  },
  api: {},
  imageUrl: (u) => u,
}))

const AdminProductEdit = (await import('./ProductEdit')).default

let container
let root

const photos = (count) =>
  Array.from({ length: count }, (_, i) => new File(['photo'], `photo-${i + 1}.jpg`, { type: 'image/jpeg' }))

/** Hand the picker a selection the way the browser would. */
const choose = async (files) => {
  const input = container.querySelector('input[type="file"]')
  Object.defineProperty(input, 'files', { configurable: true, value: files })

  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  upload.mockReset()
  upload.mockImplementation((_locale, file) =>
    Promise.resolve({ path: `uploads/${file.name}`, url: `/images/uploads/${file.name}` }),
  )

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/fr/admin/products/new']}>
        <AdminProductEdit />
      </MemoryRouter>,
    )
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('AdminProductEdit upload', () => {
  it('uploads every photo in one selection', async () => {
    await choose(photos(3))

    expect(upload).toHaveBeenCalledTimes(3)
    expect([...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([
      '/images/uploads/photo-1.jpg',
      '/images/uploads/photo-2.jpg',
      '/images/uploads/photo-3.jpg',
    ])
  })

  it('sends only what fits in the eight-image gallery', async () => {
    await choose(photos(10))

    expect(upload).toHaveBeenCalledTimes(8)
    expect(container.querySelectorAll('img')).toHaveLength(8)
    expect(container.textContent).toContain('imageLimit')
  })

  it('counts the photos already in the gallery against the limit', async () => {
    await choose(photos(6))
    await choose(photos(4).map((_, i) => new File(['photo'], `extra-${i + 1}.jpg`, { type: 'image/jpeg' })))

    expect(upload).toHaveBeenCalledTimes(8)
    expect(container.querySelectorAll('img')).toHaveLength(8)
  })
})
