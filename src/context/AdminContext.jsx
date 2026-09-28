import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { adminApi } from '../lib/api'
import { useApp } from './AppContext'

/**
 * Admin session.
 *
 * The backend hands out a Sanctum personal access token, which the API client
 * already reads from `chamma_admin_token` and sends as a Bearer header. All this
 * provider adds is who that token belongs to, and a single place to drop it.
 */
const TOKEN_KEY = 'chamma_admin_token'

const AdminContext = createContext(null)

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem('chama_admin_token')
  } catch {
    return null
  }
}

const writeToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Private browsing with storage disabled: the session simply lasts until
    // the tab is closed.
  }
}

export function AdminProvider({ children }) {
  const { locale } = useApp()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  const signOut = useCallback(() => {
    writeToken(null)
    setUser(null)
  }, [])

  // A stored token proves nothing on its own: it can be revoked or expire while
  // the tab sits open, so it is exchanged for the current user once on mount.
  useEffect(() => {
    if (!readToken()) {
      setReady(true)
      return
    }

    let alive = true

    adminApi
      .me(locale)
      .then((d) => {
        if (alive) setUser(d.user)
      })
      .catch(() => {
        if (alive) writeToken(null)
      })
      .finally(() => {
        if (alive) setReady(true)
      })

    return () => {
      alive = false
    }
  }, [locale])

  const login = useCallback(
    async (email, password) => {
      const data = await adminApi.login(locale, { email, password })
      writeToken(data.token)
      setUser(data.user)
      return data.user
    },
    [locale],
  )

  const logout = useCallback(async () => {
    // Revoke server-side, but never let a failed call trap the admin in a
    // session they asked to leave.
    try {
      await adminApi.logout(locale)
    } catch {
      // Ignored on purpose.
    }
    signOut()
  }, [locale, signOut])

  /**
   * Runs an admin request and turns a rejected token into a sign-out, so one
   * stale session bounces the admin to the login screen instead of leaving
   * every screen quietly failing.
   */
  const call = useCallback(
    async (fn) => {
      try {
        return await fn()
      } catch (err) {
        if (err.status === 401) signOut()
        throw err
      }
    },
    [signOut],
  )

  return <AdminContext.Provider value={{ user, ready, login, logout, signOut, call }}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used inside AdminProvider')
  return ctx
}
