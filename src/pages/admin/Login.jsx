import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAdmin } from '../../context/AdminContext'
import { TextInput } from '../../components/admin/Form'
import { Banner, PrimaryButton } from '../../components/admin/Ui'

export default function AdminLogin() {
  const { locale, t } = useApp()
  const { user, ready, login } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Already signed in: nothing to do here.
  if (ready && user) {
    return <Navigate to={`/${locale}/admin/dashboard`} replace />
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      await login(email.trim(), password)
      const from = location.state?.from
      navigate(from && from.startsWith(`/${locale}/admin`) ? from : `/${locale}/admin/dashboard`, { replace: true })
    } catch (err) {
      // The API answers a bad login with a translated 422 message.
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-noir px-4 py-12">
      <div className="w-full max-w-md">
        <div className="border border-stone-200 bg-ivory p-7">
          <p className="text-[10px] uppercase tracking-widest text-stone-400">{t('admin', 'title')}</p>
          <h1 className="mt-1 font-serif text-2xl text-noir">{t('admin', 'loginTitle')}</h1>
          <p className="mt-1.5 text-sm text-stone-500">{t('admin', 'loginSubtitle')}</p>

          {error && (
            <div className="mt-5">
              <Banner>{error}</Banner>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <TextInput
              label={t('admin', 'email')}
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextInput
              label={t('admin', 'password')}
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PrimaryButton type="submit" disabled={busy} className="w-full py-3">
              {busy ? t('admin', 'signingIn') : t('admin', 'signIn')}
            </PrimaryButton>
          </form>
        </div>

        <a
          href={`/${locale}/products`}
          className="mt-5 block text-center text-xs uppercase tracking-widest text-stone-300 transition hover:text-white"
        >
          {t('admin', 'viewStore')}
        </a>
      </div>
    </div>
  )
}
