import { useEffect, useState } from 'react'
import { api, imageUrl } from '../lib/api'
import { useApp } from '../context/AppContext'
import useSeo from '../hooks/useSeo'
import Carousel from '../components/Carousel'
import { absolute } from '../lib/seo'
import { ErrorState, Spinner } from '../components/Spinner'

/**
 * The customer reviews: WhatsApp conversation screenshots, one carousel the
 * visitor swipes through.
 *
 * The page is deliberately nothing but the conversations — the screenshots
 * are the copy, the proof, and the entertainment at once. A frame holds every
 * slide to one height (the Carousel's viewport clips vertical overflow, so
 * `object-contain` on a fixed frame is what keeps a tall screenshot whole),
 * and the shared `Carousel` supplies the swipe, the arrows and the dots,
 * including their RTL flipping.
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
          perViewClass="[--pv:1] sm:[--pv:2] lg:[--pv:3]"
          className="mt-10"
          renderItem={(review) => (
            <figure className="h-[480px] overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 sm:h-[560px]">
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
    </div>
  )
}
