import { useEffect, useState } from 'react'

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Skopje',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})
const date = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Skopje',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])
  return (
    <aside className="live-clock" aria-label="Current time in Europe/Skopje">
      <div className="clock-heading">
        <span className="clock-dot" aria-hidden="true" /> Current time · Europe/Skopje
      </div>
      <div className="clock-face" aria-live="off">
        <time dateTime={now.toISOString()}>{clock.format(now)}</time>
      </div>
      <p className="clock-date" aria-live="off">
        {date.format(now)}
      </p>
    </aside>
  )
}
