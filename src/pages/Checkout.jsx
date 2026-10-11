import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import useSeo from '../hooks/useSeo'
import { EmptyState } from '../components/Spinner'
import {
  useCheckoutForm,
  CheckoutFields,
  OrderSummary,
  PlaceOrderButton,
  CheckoutError,
} from '../components/CheckoutForm'

/**
 * The full-page checkout.
 *
 * The form itself lives in `components/CheckoutForm.jsx`, shared with the
 * drawer that slides in when something is added to the cart. What is left here
 * is the page around it: the SEO tag, the empty-cart guard, the progress steps,
 * and the two-column arrangement — the fields on the left, a sticky order
 * summary on the right.
 */
export default function Checkout() {
  const { locale, t, cart } = useApp()

  useSeo({ title: `${t('cart', 'checkout')} | ${t('seo', 'siteName')}`, noindex: true })

  const c = useCheckoutForm()

  if (cart.length === 0) {
    return (
      <EmptyState
        title={t('cart', 'empty')}
        action={
          <Link
            to={`/${locale}/products`}
            className="inline-block rounded-full bg-noir px-7 py-3 text-xs uppercase tracking-widest text-white transition hover:bg-gold"
          >
            {t('nav', 'shop')}
          </Link>
        }
      />
    )
  }

  // Three steps, with the middle one — this page — marked current. The first is
  // behind the shopper (the cart they came from), the last is what the button
  // below produces.
  const steps = [
    { label: t('checkout', 'navCart'), state: 'done' },
    { label: t('checkout', 'navInfo'), state: 'current' },
    { label: t('checkout', 'navConfirm'), state: 'todo' },
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8">
          <Link
            to={`/${locale}/products`}
            className="mb-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-stone-400 transition hover:text-gold"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 rtl:-scale-x-100">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('nav', 'shop')}
          </Link>

          <h1 className="font-serif text-3xl text-noir sm:text-4xl">{t('checkout', 'title')}</h1>

          <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3 text-xs sm:gap-x-3">
            {steps.map((step, i) => (
              <li key={step.label} className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition ${
                    step.state === 'done'
                      ? 'bg-jade text-white'
                      : step.state === 'current'
                        ? 'bg-noir text-white shadow-sm shadow-noir/20'
                        : 'border border-stone-200 bg-white text-stone-400'
                  }`}
                >
                  {step.state === 'done' ? (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`font-medium tracking-wide ${
                    step.state === 'todo' ? 'text-stone-400' : 'text-noir'
                  }`}
                >
                  {step.label}
                </span>
                {i < steps.length - 1 && <span className="mx-1 hidden h-px w-8 bg-stone-200 sm:block" />}
              </li>
            ))}
          </ol>
        </div>

        {/* Two columns on desktop: the fields get the room to be filled in, the
            summary stays in view as a card on the right. On mobile the summary
            still comes first in the document (so it can be checked at a glance)
            and the columns collapse to a single stack. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
          <aside className="lg:order-2 lg:sticky lg:top-24">
            <OrderSummary
              c={c}
              className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm shadow-stone-200/60 sm:p-6"
            />
          </aside>

          <div className="lg:order-1">
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm shadow-stone-200/60 sm:p-7">
              <CheckoutError message={c.message} errors={c.errors} />

              <form id={c.formId} onSubmit={c.submit} noValidate>
                <CheckoutFields c={c} />
              </form>
            </div>

            <PlaceOrderButton c={c} className="mt-6" />
          </div>
        </div>
      </div>
    </div>
  )
}
