import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

export function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-ivory text-noir">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
