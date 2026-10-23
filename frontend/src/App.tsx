import { useEffect, useState } from 'react'

const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

function App() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()

    async function checkHealth() {
      try {
        const response = await fetch(`${apiUrl}/api/health`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Health request failed: HTTP ${response.status}`)
        }

        const health = await response.json()
        if (health.status !== 'ok' || health.service !== 'Unblock API') {
          throw new Error('Unexpected health response')
        }

        if (!controller.signal.aborted) setStatus('success')
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }

    void checkHealth()
    return () => controller.abort()
  }, [])

  return (
    <main>
      <h1>Unblock — Automation Clinic</h1>
      <p role="status">
        {status === 'loading' && 'Connecting to Unblock API...'}
        {status === 'success' && 'Connected to Unblock API. Status: ok.'}
        {status === 'error' &&
          `Unable to connect to Unblock API at ${apiUrl}. Check that the backend is running, VITE_API_URL is correct, and FRONTEND_ORIGIN matches this page's origin. Then reload the page.`}
      </p>
    </main>
  )
}

export default App
