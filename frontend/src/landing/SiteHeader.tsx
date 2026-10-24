export function SiteHeader({ managing }: { managing: boolean }) {
  return (
    <header className="landing-header">
      <a className="landing-wordmark" href="#book" aria-label="Unblock home">
        <span className="wordmark-symbol" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        unblock<span className="wordmark-period">.</span>
      </a>
      <nav aria-label="Main navigation">
        <a className="how-link" href="#how-it-works">
          How it works
        </a>
        <a
          className="host-link"
          href="#manage"
          aria-current={managing ? 'page' : undefined}
        >
          Host access
        </a>
        <a className="landing-button header-cta" href="#booking-panel">
          Book a session <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </header>
  )
}
