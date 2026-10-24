import { useEffect, useRef, useState } from 'react'
import { ApiError, getHostSession, loginHost, logoutHost } from '../booking/api'
import type { HostSession } from '../booking/api'
import { AvailabilityPage } from './AvailabilityPage'

export function HostPage() {
  const [session, setSession] = useState<HostSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!loading) document.getElementById('host-title')?.focus()
  }, [loading, session?.authenticated])

  function reloadSession() {
    setLoading(true)
    setRefresh((value) => value + 1)
  }

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    void getHostSession(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setSession(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSession(null)
          setLoading(false)
          setError(
            'Could not check host access. Check the API connection and retry.',
          )
        }
      })
    return () => controller.abort()
  }, [refresh])

  // The server enforces expiry; this timer also updates the visible form.
  useEffect(() => {
    if (!session) return
    const timeout = window.setTimeout(
      () => {
        setError('Your host session expired. Please sign in again.')
        reloadSession()
      },
      Math.max(0, Date.parse(session.expiresAt) - Date.now()),
    )
    return () => window.clearTimeout(timeout)
  }, [session])

  async function signIn() {
    if (request.current || !session) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError('')
    try {
      const result = await loginHost(
        password,
        session.csrfToken,
        controller.signal,
      )
      if (!controller.signal.aborted) setSession(result)
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(
          failure instanceof ApiError && failure.status === 401
            ? 'Incorrect host password.'
            : failure instanceof ApiError
              ? failure.message
              : 'Could not sign in. Check your connection and retry.',
        )
        if (failure instanceof ApiError && failure.status === 403)
          reloadSession()
      }
    } finally {
      request.current = null
      if (!controller.signal.aborted) {
        setPending(false)
        setPassword('')
      }
    }
  }

  async function signOut() {
    if (request.current || !session) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError('')
    try {
      await logoutHost(session.csrfToken, controller.signal)
      if (!controller.signal.aborted) {
        setSession(null)
        reloadSession()
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure instanceof ApiError && failure.status === 401) {
          setSession(null)
          reloadSession()
        } else setError('Could not sign out. Please retry.')
      }
    } finally {
      request.current = null
      if (!controller.signal.aborted) setPending(false)
    }
  }

  if (!loading && session?.authenticated)
    return (
      <>
        <section className="host-session-bar" aria-label="Host session">
          <p>
            Signed in as the single host. Session expires{' '}
            {new Date(session.expiresAt).toLocaleTimeString('en-GB', {
              timeZone: 'Europe/Skopje',
            })}{' '}
            (Europe/Skopje).
          </p>
          <button
            type="button"
            className="secondary"
            disabled={pending}
            onClick={() => void signOut()}
          >
            {pending ? 'Signing out…' : 'Log out'}
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </section>
        <AvailabilityPage
          csrfToken={session.csrfToken}
          onSessionExpired={() => {
            setSession(null)
            setError('Your host session expired. Please sign in again.')
            reloadSession()
          }}
        />
      </>
    )

  return (
    <main className="host-page">
      <header className="host-hero">
        <p className="eyebrow">HOST WORKSPACE / PRIVATE ENTRY</p>
        <h1 id="host-title" tabIndex={-1}>
          Host <span>access.</span>
        </h1>
        <p>
          Sign in to manage Unblock’s availability. Booking stays public; there
          are no visitor accounts.
        </p>
      </header>
      {loading && <p role="status">Checking host access…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!loading && !session && (
        <button type="button" onClick={reloadSession}>
          Retry host access
        </button>
      )}
      {!loading && session && (
        <section className="host-login-panel" aria-label="Host sign in">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void signIn()
            }}
          >
            <fieldset disabled={pending}>
              <legend className="sr-only">Single-host password</legend>
              <h2>Make room for a conversation.</h2>
              <p className="form-intro">
                Use the host password to publish availability.
              </p>
              <label htmlFor="host-password">Host password</label>
              <input
                id="host-password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="submit" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}{' '}
                <span aria-hidden="true">↗</span>
              </button>
            </fieldset>
          </form>
        </section>
      )}
    </main>
  )
}
