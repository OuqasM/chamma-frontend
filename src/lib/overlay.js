import { useEffect, useState } from 'react'

/**
 * Overlay plumbing shared by the header's menus and the checkout drawer.
 *
 * These live here rather than in one of the two components because the awkward
 * parts of an overlay are the same awkward parts wherever it is mounted: keeping
 * it mounted long enough to animate out, and dismissing it without swallowing
 * the click that landed on it. Two copies of either would drift, and a drawer
 * that animates differently from the menu beside it reads as a bug.
 */

// Matches the `transition` duration of `.drawer` and `.drawer-left` in index.css.
export const DRAWER_MS = 380
// Matches the `transition` duration of `.mega` in index.css.
export const MEGA_MS = 260
// Matches the `transition` duration of `.dropdown` in index.css.
export const DROPDOWN_MS = 180

/**
 * Closes an overlay on Escape or on a pointer press outside every given ref.
 *
 * Listens on `mousedown` rather than `click` so the overlay is already gone by
 * the time the click would land on whatever is underneath it — otherwise a
 * shopper dismissing the drawer by tapping the page behind it also activates
 * the product they were looking at.
 */
export function useDismiss(refs, open, setOpen) {
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      const inside = refs.some((r) => r.current && r.current.contains(e.target))
      if (!inside) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, refs, setOpen])
}

/**
 * The two phases an animated panel or menu needs.
 *
 * `mounted` — keep the element in the document for the length of its exit
 * transition. Unmounting the instant `open` flips to false leaves no frame to
 * animate, so the panel vanishes instead of sliding away.
 *
 * `shown` — one frame behind `open` on the way in. An element that mounts
 * already-open has its *final* computed style on the first paint, so the
 * browser has nothing to transition from and it simply appears. Mounting it
 * closed and flipping `shown` on the next frame gives the transition a
 * starting position.
 */
export function useOverlayTransition(open, ms) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    // Collapses straight away, then stays mounted long enough to slide out.
    setShown(false)
    if (!mounted) return
    const timer = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(timer)
  }, [open, mounted, ms])

  useEffect(() => {
    if (!open || !mounted) return
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [open, mounted])

  return { mounted, shown }
}

/**
 * Stops the page behind an overlay scrolling under the shopper's finger.
 *
 * Restores whatever was there rather than clearing the property: an overlay
 * opened on top of another one — the checkout drawer over a menu — must not
 * leave `overflow: visible` behind it when it closes, which is what setting it
 * to `''` would do.
 */
export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [active])
}
