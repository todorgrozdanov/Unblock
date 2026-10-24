import { BookingPage } from './booking/BookingPage'
import { useEffect, useState } from 'react'
import { AvailabilityPage } from './host/AvailabilityPage'

export default function App() {
  const [page, setPage] = useState(
    window.location.hash === '#manage' ? 'manage' : 'book',
  )
  useEffect(() => {
    const onNavigation = () =>
      setPage(window.location.hash === '#manage' ? 'manage' : 'book')
    window.addEventListener('hashchange', onNavigation)
    return () => window.removeEventListener('hashchange', onNavigation)
  }, [])
  return (
    <>
      <nav className="page-navigation" aria-label="Main navigation">
        <a href="#book" aria-current={page === 'book' ? 'page' : undefined}>
          Book a session
        </a>
        <a href="#manage" aria-current={page === 'manage' ? 'page' : undefined}>
          Manage availability
        </a>
      </nav>
      {page === 'manage' ? <AvailabilityPage /> : <BookingPage />}
    </>
  )
}
