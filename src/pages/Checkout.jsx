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
 * is the page around it: the SEO tag, the empty-cart guard, and the order the
 * pieces appear in.
 */
export default function Checkout() {
  const { locale, t, cart } = useApp()

  useSeo({ title: `${t('cart', 'checkout')} | Chamma Store`, noindex: true })

  const c = useCheckoutForm()

  if (cart.length === 0) {
    return (
      <EmptyState
        title={t('cart', 'empty')}
        action={
          <Link
            to={`/${locale}/products`}
            className="inline-block bg-noir px-7 py-3 text-xs uppercase tracking-widest text-white hover:bg-gold"
          >
            {t('nav', 'shop')}
          </Link>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl text-noir">{t('checkout', 'title')}</h1>

      {/* One column, summary first.

          The summary used to sit in a 300px column beside the form, so the two
          things a shopper weighs — what it costs, and what it takes to buy it —
          were on screen together but neither was the first thing read. Above
          the form it also gets the full width, which is what lets the lines and
          the arithmetic sit side by side instead of stacking into a column the
          shopper scrolls past.

          The commit button is deliberately not part of that summary. It belongs
          after the last field, at the end of what there is to fill in, which is
          also what leaves exactly one button on the page: the bank-transfer
          flow puts its own submit in step 2, next to the details that made it
          necessary, and while the summary carried one as well there were two
          identical buttons to choose between. */}
      <div className="mt-8">
        <OrderSummary c={c} wide className="border border-stone-200 bg-ivory p-5 sm:p-6" />

        <div className="mt-6">
          <CheckoutError message={c.message} errors={c.errors} />
        </div>

        <form id={c.formId} onSubmit={c.submit} noValidate className="mt-8">
          <CheckoutFields c={c} />
        </form>

        <PlaceOrderButton c={c} className="mt-8" />
      </div>
    </div>
  )
}
