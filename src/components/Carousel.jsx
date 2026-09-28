import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'

/**
 * Dependency-free horizontal carousel.
 *
 * Native CSS scroll-snap does the heavy lifting, so touch swipe, momentum and
 * RTL scrolling all come from the browser. React only tracks which page is in
 * view (for the arrows + dots).
 *
 * Paging deliberately uses `viewport.scrollBy(...)` on the carousel's own
 * scroll container — never `element.scrollIntoView()`, which walks every
 * scrollable ancestor (including the document) and would yank the page to
 * another section whenever a slide advanced. `scrollBy` takes a physical
 * horizontal delta (positive = toward the right), so we measure the target
 * slide's start edge against the viewport's start edge to get a signed visual
 * distance that works identically in LTR and RTL.
 *
 * `perViewClass` is applied to the scroll viewport and is expected to set a
 * unitless `--pv` custom property at each breakpoint (e.g. `[--pv:2]
 * sm:[--pv:3] lg:[--pv:4]`). Slide width is derived from `--pv`, and the arrow
 * step and dot count follow the live value so they stay correct on resize.
 */
export default function Carousel({
  items = [],
  renderItem,
  ariaLabel,
  perViewClass = '[--pv:2] sm:[--pv:3] lg:[--pv:4]',
  autoplay = 0,
  className = '',
}) {
  const { dir, t } = useApp()
  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)
  const [perView, setPerView] = useState(2)
  const [paused, setPaused] = useState(false)
  const pageRef = useRef(0)

  const count = items.length
  const rtl = dir === 'rtl'

  const prefersReduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const measure = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const raw = parseInt(getComputedStyle(vp).getPropertyValue('--pv'), 10)
    const per = Number.isFinite(raw) && raw > 0 ? raw : 1
    setPerView(per)
    setPages(Math.max(1, Math.ceil(count / per)))
  }, [count])

  useEffect(() => {
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (viewportRef.current) ro?.observe(viewportRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const setPageBoth = useCallback((n) => {
    pageRef.current = n
    setPage(n)
  }, [])

  // Scroll ONLY the carousel's own viewport, by the physical distance from the
  // current start edge to the target slide's start edge. Positive = right.
  const scrollToIndex = useCallback(
    (target, behavior) => {
      const vp = viewportRef.current
      const track = trackRef.current
      if (!vp || !track) return
      const idx = Math.max(0, Math.min(pages - 1, target))
      const slide = track.children[idx * perView]
      if (!slide) return
      const vpRect = vp.getBoundingClientRect()
      const sRect = slide.getBoundingClientRect()
      const delta = rtl ? sRect.right - vpRect.right : sRect.left - vpRect.left
      vp.scrollBy({ left: delta, behavior: behavior || (prefersReduced ? 'auto' : 'smooth') })
      setPageBoth(idx)
    },
    [pages, perView, rtl, prefersReduced, setPageBoth]
  )

  const goTo = useCallback((target) => scrollToIndex(target), [scrollToIndex])

  // Keep the active page in sync with manual swipes, drags and trackpad.
  useEffect(() => {
    const vp = viewportRef.current
    const track = trackRef.current
    if (!vp || !track) return undefined
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const vStart = rtl ? vp.getBoundingClientRect().right : vp.getBoundingClientRect().left
        const slides = track.children
        let first = 0
        for (let i = 0; i < slides.length; i += 1) {
          const rect = slides[i].getBoundingClientRect()
          // Normalise so `progress` is ~0 for the slide at the start edge and
          // grows toward the reading direction in both LTR and RTL.
          const progress = rtl ? vStart - rect.right : rect.left - vStart
          if (progress >= -8) {
            first = i
            break
          }
        }
        setPageBoth(Math.min(pages - 1, Math.max(0, Math.floor(first / perView))))
      })
    }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      vp.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [rtl, pages, perView, setPageBoth])

  // Opt-in autoplay. Pauses on hover/focus and never runs for reduced motion.
  useEffect(() => {
    if (!autoplay || paused || prefersReduced || count === 0 || pages < 2) return undefined
    const id = setInterval(() => {
      const next = pageRef.current + 1 >= pages ? 0 : pageRef.current + 1
      scrollToIndex(next, 'smooth')
    }, autoplay)
    return () => clearInterval(id)
  }, [autoplay, paused, prefersReduced, pages, count, scrollToIndex])

  if (count === 0) return null

  const showControls = pages > 1
  const prevPath = rtl ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'
  const nextPath = rtl ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'
  const arrowBase =
    'absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-noir/15 bg-white/90 text-noir shadow-sm transition hover:border-gold hover:text-gold disabled:pointer-events-none disabled:opacity-0 md:flex'

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        ref={viewportRef}
        className={`no-scrollbar flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden ${perViewClass}`}
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
      >
        <div ref={trackRef} className="flex min-w-0 gap-4">
          {items.map((item, i) => (
            <div
              key={item?.id ?? i}
              className="flex min-w-0 flex-[0_0_calc((100%-(var(--pv)-1)*1rem)/var(--pv))] snap-start"
            >
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>

      {showControls && (
        <>
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page === 0}
            aria-label={t('common', 'prev')}
            className={`start-2 ${arrowBase}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path d={prevPath} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page >= pages - 1}
            aria-label={t('common', 'next')}
            className={`end-2 ${arrowBase}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path d={nextPath} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="mt-5 flex items-center justify-center gap-1.5">
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${ariaLabel} ${i + 1}`}
                aria-current={i === page ? 'true' : undefined}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === page ? 'w-6 bg-gold' : 'w-1.5 bg-noir/20 hover:bg-noir/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
