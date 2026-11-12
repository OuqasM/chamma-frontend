import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'

/**
 * How long the shop lets a visitor look around before asking.
 * 5s: long enough that the first paint is not interrupted, short enough
 * that most visitors are still on the page to see it.
 */
const SHOW_DELAY_MS = 5000

/**
 * How long the message stays up once shown. 3s per the owner: it is an
 * invitation, not a banner — long enough to read one line, short enough
 * that nobody has to dismiss it.
 */
const MESSAGE_MS = 3000

/**
 * Session flag. The message is shown once per browser session: a visitor who
 * has seen it (or a reload five minutes into a browsing session) gets the
 * button back, not the same pitch again. `sessionStorage` survives reloads
 * and dies with the tab, which is exactly the span "once per session" means.
 */
const SEEN_KEY = 'chamma_reviews_prompt_seen'

const readSeen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* storage unavailable; the prompt just shows again next load */
  }
}

/**
 * The floating prompt for the customer reviews: a button parked above the
 * WhatsApp button, with a one-line message that slides in after 5 seconds,
 * stays 3, and goes — while the button stays put for the rest of the
 * session, the way the WhatsApp button does.
 *
 * Behaviour, decided with the owner:
 *
 * - The message shows once per browser session; the floating button
 *   persists (a reload in the same session brings the button straight
 *   back, without the 5s wait and without the message again).
 * - The line is the Darija the owner asked for ("بغيتي تعرف شنو كيقلوا
 *   علينا ؟") on **every** language — after seeing it translated he asked
 *   for Darija everywhere: the shop's customers read Darija whichever
 *   language they browse in. Only this line; the rest of the feature's
 *   copy stays translated per language.
 * - The whole thing stays hidden until the shop actually has reviews to
 *   show off — an empty pitch would advertise an empty page.
 * - On the reviews page itself the prompt stands down: a button pointing
 *   at the page it is already on is noise.
 *
 * The container is pinned to `dir="ltr"` on purpose. The WhatsApp button
 * anchors to the physical bottom-right in every locale, and this prompt
 * must sit exactly above it — but a plain flex row inside the Arabic
 * document flows right-to-left, which would put the *message* on the
 * corner and shove the round button a bubble's width away from the
 * WhatsApp button it is meant to stack on. Forcing the row's direction
 * keeps [message, button] physical; the Arabic line inside the message
 * still reads right-to-left on its own (`dir="auto"`), and the message's
 * tail corner is a physical `rounded-br` so it faces the button in every
 * locale.
 */
export default function ReviewsPrompt() {
  const { locale, t } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  // `null` while the answer is in flight; an empty list renders nothing.
  const [hasReviews, setHasReviews] = useState(null)
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState(false)
  // The timers outlive the renders that schedule them, so cleanup can
  // cancel them by ref rather than by effect-local variable.
  const timers = useRef([])

  useEffect(() => {
    let alive = true
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        if (alive) fn()
      }, ms)
      timers.current.push(id)
    }

    api
      .reviews(locale)
      .then((data) => {
        if (!alive) return
        if (!(data?.data || []).length) return

        setHasReviews(true)
        if (readSeen()) {
          // The session has already seen the pitch: the button is a
          // fixture now, and it comes back without the delay or the line.
          setVisible(true)
          return
        }

        later(() => {
          markSeen()
          setVisible(true)
          setMessage(true)
          later(() => setMessage(false), MESSAGE_MS)
        }, SHOW_DELAY_MS)
      })
      .catch(() => {
        /* a failed read leaves the prompt down; the footer link still reaches the page */
      })

    return () => {
      alive = false
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [locale])

  if (!hasReviews || !visible) return null
  // Pointing at the page it opens: stand down while the visitor is there.
  if (location.pathname.endsWith('/reviews')) return null

  const go = () => navigate(`/${locale}/reviews`)

  return (
    <div dir="ltr" className="fixed bottom-[84px] right-6 z-50 flex items-end gap-2.5 md:bottom-[96px] md:right-8">
      {/* The message, mounted only while it shows — hidden text that stays in
          the accessibility tree would be announced to screen readers that can
          see nothing on screen. A button rather than a div: tapping it goes
          where the round button does, which is what a line pointing at
          reviews implies. `dir="auto"` lets the line set its own paragraph
          direction: it is Darija now on every page, including the LTR ones. */}
      {message && (
        <button
          type="button"
          dir="auto"
          onClick={go}
          className="max-w-[240px] animate-[reviews-prompt-in_.3s_ease-out] rounded-2xl rounded-br-md border border-stone-200/80 bg-ivory px-4 py-3 text-start text-[13px] font-medium leading-snug text-noir shadow-[0_10px_30px_-12px_rgba(58,29,39,0.45)] transition-colors hover:border-gold/60"
        >
          {t('reviews', 'popupMessage')}
        </button>
      )}

      <button
        type="button"
        onClick={go}
        aria-label={t('reviews', 'popupButton')}
        className="flex h-12 w-12 shrink-0 animate-[reviews-prompt-in_.45s_ease-out] items-center justify-center rounded-full bg-noir text-white shadow-lg ring-2 ring-gold/40 transition hover:bg-plum"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          <path d="m12 7.2 1.15 2.33 2.57.37-1.86 1.82.44 2.56L12 12.97l-2.3 1.21.44-2.56-1.86-1.82 2.57-.37Z" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </div>
  )
}
