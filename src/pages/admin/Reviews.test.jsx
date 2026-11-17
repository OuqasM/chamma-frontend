// @vitest-environment jsdom
/**
 * Admin: the customer reviews (WhatsApp screenshots).
 *
 * The panel side of the reviews feature. What is worth pinning: the form
 * cannot be saved without a screenshot (the owner asked for screenshots, not
 * for placeholder rows), the upload's returned path is what the create call
 * carries, and deleting a row really deletes it.
 */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const reviews = vi.fn()
const createReview = vi.fn()
const createReviews = vi.fn()
const updateReview = vi.fn()
const deleteReview = vi.fn()
const upload = vi.fn()

const t = (_group, key, vars) => (vars ? `${key}:${Object.values(vars)[0]}` : key)
const call = (fn) => fn(new AbortController().signal)

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ locale: 'fr', t }),
}))

vi.mock('../../context/AdminContext', () => ({
  useAdmin: () => ({ call }),
}))

vi.mock('../../lib/api', () => ({
  adminApi: { reviews, createReview, createReviews, updateReview, deleteReview, upload },
  api: {},
  imageUrl: (u) => u,
}))

const AdminReviews = (await import('./Reviews')).default

let container
let root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  ;[reviews, createReview, createReviews, updateReview, deleteReview, upload].forEach((m) => m.mockReset())
})

/** Load the list and wait for the render to settle. */
const renderWith = async (payload) => {
  reviews.mockResolvedValue(payload)
  await act(async () => {
    root.render(
      <MemoryRouter>
        <AdminReviews />
      </MemoryRouter>,
    )
  })
  await act(async () => {})
}

const row = (overrides = {}) => ({
  id: 4,
  image: '/images/uploads/a.png',
  image_path: 'uploads/a.png',
  position: 0,
  is_active: true,
  ...overrides,
})

/** Load the list, open the create modal, upload a screenshot, and save. */
const createThrough = async (created) => {
  createReviews.mockResolvedValue({ reviews: [row()] })
  await renderWith({ data: [row(), created] })

  await act(async () => {
    ;[...container.querySelectorAll('button')].find((b) => b.textContent === 'create').click()
  })

  const input = container.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { value: [new File(['x'], 'chat.png', { type: 'image/png' })] })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })

  const save = [...container.querySelectorAll('button')].find((b) => b.textContent === 'save')
  expect(save.disabled).toBe(false)

  await act(async () => {
    save.click()
  })
  await act(async () => {})
}

/** Open the create modal and hand the picker a whole selection. */
const choose = async (files) => {
  const input = container.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const openCreate = async () => {
  await act(async () => {
    ;[...container.querySelectorAll('button')].find((b) => b.textContent === 'create').click()
  })
}

describe('the reviews list', () => {
  it('shows every screenshot with its order and its switch state', async () => {
    await renderWith({
      data: [
        row({ id: 4, position: 1, is_active: true }),
        row({ id: 5, image_path: 'uploads/b.png', position: 0, is_active: false }),
      ],
    })

    const rows = [...container.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('1')
    expect(rows[0].textContent).toContain('active')
    expect(rows[1].textContent).toContain('inactive')
  })

  it('says when the shop has not collected any yet', async () => {
    await renderWith({ data: [] })

    expect(container.textContent).toContain('noReviews')
  })
})

describe('adding a review', () => {
  it('sends the uploaded path, not the file', async () => {
    upload.mockResolvedValue({ path: 'uploads/uploaded.png' })
    await createThrough(row({ id: 9, image_path: 'uploads/uploaded.png' }))

    expect(upload).toHaveBeenCalledTimes(1)
    expect(createReviews).toHaveBeenCalledTimes(1)
    const body = createReviews.mock.calls[0][1]
    expect(body.images).toEqual(['uploads/uploaded.png'])
    expect(body.is_active).toBe(true)
    // The owner left the order blank: nothing is sent, so the column's
    // default (append last) applies rather than a null.
    expect(body).not.toHaveProperty('position')
  })

  it('turns a whole selection into that many reviews', async () => {
    upload.mockImplementation((_locale, file) => Promise.resolve({ path: `uploads/${file.name}` }))
    createReviews.mockResolvedValue({ reviews: [] })
    await renderWith({ data: [] })
    await openCreate()

    await choose([
      new File(['x'], 'one.png', { type: 'image/png' }),
      new File(['x'], 'two.png', { type: 'image/png' }),
      new File(['x'], 'three.png', { type: 'image/png' }),
    ])

    expect(upload).toHaveBeenCalledTimes(3)
    expect(container.querySelectorAll('#review-form img')).toHaveLength(3)

    const save = [...container.querySelectorAll('button')].find((b) => b.textContent === 'save')
    await act(async () => {
      save.click()
    })
    await act(async () => {})

    expect(createReviews).toHaveBeenCalledWith('fr', {
      images: ['uploads/one.png', 'uploads/two.png', 'uploads/three.png'],
      is_active: true,
    })
  })

  it('numbers the batch from the order the owner typed', async () => {
    upload.mockImplementation((_locale, file) => Promise.resolve({ path: `uploads/${file.name}` }))
    createReviews.mockResolvedValue({ reviews: [] })
    await renderWith({ data: [] })
    await openCreate()

    const position = container.querySelector('#review-form input[type=number]')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(position, '4')
      position.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await choose([
      new File(['x'], 'one.png', { type: 'image/png' }),
      new File(['x'], 'two.png', { type: 'image/png' }),
    ])

    const save = [...container.querySelectorAll('button')].find((b) => b.textContent === 'save')
    await act(async () => {
      save.click()
    })
    await act(async () => {})

    expect(createReviews.mock.calls[0][1]).toMatchObject({
      images: ['uploads/one.png', 'uploads/two.png'],
      position: 4,
    })
  })

  it('cannot be saved without a screenshot', async () => {
    await renderWith({ data: [] })
    await openCreate()

    const save = [...container.querySelectorAll('button')].find((b) => b.textContent === 'save')
    expect(save.disabled).toBe(true)
    expect(createReview).not.toHaveBeenCalled()
    expect(createReviews).not.toHaveBeenCalled()
  })
})

describe('deleting a review', () => {
  it('goes through the two-step confirm', async () => {
    deleteReview.mockResolvedValue({ message: 'deleted' })
    await renderWith({ data: [row()] })

    // Open the row's action menu, arm the delete, then confirm.
    await act(async () => {
      container.querySelector('button[aria-haspopup="menu"]').click()
    })
    const item = () => [...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent === 'delete')
    expect(item()).toBeDefined()

    await act(async () => {
      item().click()
    })
    const confirm = () => [...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent === 'confirm')
    expect(confirm()).toBeDefined()

    await act(async () => {
      confirm().click()
    })
    await act(async () => {})

    expect(deleteReview).toHaveBeenCalledWith('fr', 4)
  })
})
