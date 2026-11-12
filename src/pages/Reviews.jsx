import { useEffect, useState } from 'react'
import { api, imageUrl } from '../lib/api'
import { useApp } from '../context/AppContext'
import useSeo from '../hooks/useSeo'
import Carousel from '../components/Carousel'
import Catalogue from './Catalogue'
import { absolute } from '../lib/seo'
import { ErrorState, Spinner } from '../components/Spinner'

/**
 * The customer reviews: WhatsApp conversation screenshots, one at a time,
 * swiped through — with the store right underneath.
 *
 * Two decisions shape it, both the owner's:
 *
 * - **One image per view, on every screen.** A screenshot is a conversation
 *   between two people; two of them side by side read as clutter and neither
 *   gets looked at properly. So the carousel runs `[--pv:1]` at every
 *   breakpoint — a visitor swipes (or uses the arrows) from one conversation
 *   to the next, each shown at the largest size the screen allows. The frame
 *   is viewport-height rather than fixed so a tall screenshot fills a desktop
 *   without ever being asked to fit a row it cannot fill.
 *
 * - **The store follows.** The page's job does not end at "look how happy
 *   they are": a visitor convinced by the conversations is exactly one
 *   product grid away from buying, so the boutique's own catalogue — the same
 *   filters, the same sorting, the same page row the home page embeds — sits
 *   under the carousel. Embedded, not linked: going back to the menu to then
 *   find "Boutique" is the detour this page exists to remove. `embedded`
 *   leaves the page's metadata to the useSeo above and renders its heading
 *   as an `h2`.
 */
export default function Reviews() {
  const { locale, t } = useApp()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    api
      .reviews(locale)
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [locale])

  const title = t('reviews', 'title')

  useSeo({
    title: `${title} | ${t('seo', 'siteName')}`,
    description: t('seo', 'reviewsDescription'),
    canonical: absolute(`/${locale}/reviews`),
    alternates: {
      fr: absolute('/fr/reviews'),
      ar: absolute('/ar/reviews'),
      en: absolute('/en/reviews'),
    },
  })

  if (error) return <ErrorState message={error} />
  if (!data) return <Spinner label={t('common', 'loading')} />

  const reviews = data.data || []

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mx-auto max-w-xl text-center">
        <h1 className="font-serif text-3xl text-noir">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-500">{t('reviews', 'subtitle')}</p>
      </header>

      {reviews.length === 0 ? (
        <p className="py-16 text-center font-serif text-xl text-stone-500">{t('reviews', 'empty')}</p>
      ) : (
        <Carousel
          items={reviews}
          ariaLabel={title}
          // One conversation at a time, on every screen — swiped on a touch
          // screen, arrowed on a desktop. The frame is the viewport's height
          // (bounded), so a portrait screenshot is shown as large as the
          // screen can hold it and the carousel's vertical clipping never
          // cuts one.
          perViewClass="[--pv:1]"
          className="mt-10"
          renderItem={(review) => (
            <figure className="h-[70vh] max-h-[760px] min-h-[440px] overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
              <img
                src={imageUrl(review.image)}
                alt=""
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </figure>
          )}
        />
      )}

      {/* The store, so the proof ends in a purchase. */}
      <Catalogue mode="all" embedded />
    </div>
  )
}
