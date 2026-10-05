import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import CartDrawer from '../components/CartDrawer'

export function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-ivory text-noir">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      {/* Outside `<main>` so it is not in the content flow, and mounted once for
          the whole storefront rather than per page — it has to survive a
          navigation to keep whatever the shopper has already filled in. */}
      <CartDrawer />
    </div>
  )
}
