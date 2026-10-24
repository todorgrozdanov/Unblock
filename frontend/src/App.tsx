import { BookingPage } from './booking/BookingPage'
import { useEffect, useState } from 'react'
import { HostPage } from './host/HostPage'
import { SiteHeader } from './landing/SiteHeader'

export default function App() {
  const [page, setPage] = useState(
    window.location.pathname.replace(/\/$/, '') === '/host' ||
      window.location.hash === '#manage'
      ? 'manage'
      : 'book',
  )
  useEffect(() => {
    const onNavigation = () =>
      setPage(
        window.location.pathname.replace(/\/$/, '') === '/host' ||
          window.location.hash === '#manage'
          ? 'manage'
          : 'book',
      )
    window.addEventListener('hashchange', onNavigation)
    return () => window.removeEventListener('hashchange', onNavigation)
  }, [])
  // A section link from the host page must wait for the public page to mount.
  useEffect(() => {
    if (page !== 'book') return
    const target = window.location.hash.slice(1)
    if (target) document.getElementById(target)?.scrollIntoView()
  }, [page])
  return (
    <>
      <SiteHeader managing={page === 'manage'} />
      {page === 'manage' ? <HostPage /> : <BookingPage />}
    </>
  )
}
