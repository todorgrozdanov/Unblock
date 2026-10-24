import { useEffect, useRef, useState } from 'react'
import { ApiError, createSlot, getSlots } from '../booking/api'
import type { Slot } from '../booking/types'
import { slotDate, slotTime } from '../booking/time'
import {
  getTimeOptions,
  isFutureInstant,
  schedulingTimezone,
} from './scheduling'
import type { TimeOption } from './scheduling'

export function AvailabilityPage({
  csrfToken,
  onSessionExpired,
}: {
  csrfToken: string
  onSessionExpired: () => void
}) {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('30')
  const [occurrence, setOccurrence] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<Slot | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [refresh, setRefresh] = useState(0)
  const submission = useRef<AbortController | null>(null)

  let options: TimeOption[] = []
  let timeError = ''
  if (date && time) {
    try {
      options = getTimeOptions(date, time)
    } catch (failure) {
      timeError =
        failure instanceof Error ? failure.message : 'Invalid date or time.'
    }
  }
  const instant =
    options.length === 1
      ? options[0].instant
      : options.find((option) => option.instant === occurrence)?.instant

  function refreshSlots() {
    setLoadState('loading')
    setRefresh((value) => value + 1)
  }

  useEffect(() => () => submission.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    void getSlots(controller.signal)
      .then((available) => {
        if (controller.signal.aborted) return
        setSlots(available)
        setLoadState('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState('error')
      })
    return () => controller.abort()
  }, [refresh])

  async function submit() {
    if (submission.current) return
    setError('')
    if (!instant) {
      setError(
        timeError ||
          'Choose a date, start time, and an occurrence if the time repeats.',
      )
      return
    }
    if (!isFutureInstant(instant)) {
      setError('The start time must be in the future.')
      return
    }
    const minutes = Number(duration)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) {
      setError('Duration must be an integer from 1 to 480 minutes.')
      return
    }
    const controller = new AbortController()
    submission.current = controller
    setPending(true)
    setCreated(null)
    try {
      const result = await createSlot(
        instant,
        minutes,
        controller.signal,
        csrfToken,
      )
      if (controller.signal.aborted) return
      setCreated(result)
      setDate('')
      setTime('')
      setOccurrence('')
      refreshSlots()
    } catch (failure) {
      if (
        !controller.signal.aborted &&
        failure instanceof ApiError &&
        failure.status === 401
      ) {
        onSessionExpired()
        return
      }
      if (!controller.signal.aborted)
        setError(
          failure instanceof ApiError
            ? failure.message
            : 'Could not confirm slot creation. Your input is preserved. Check the available list before retrying; the request may have reached the server.',
        )
    } finally {
      submission.current = null
      if (!controller.signal.aborted) setPending(false)
    }
  }

  return (
    <main className="host-page">
      <header className="host-hero">
        <p className="eyebrow">HOST WORKSPACE / AVAILABILITY</p>
        <h1 id="host-title" tabIndex={-1}>
          Your time,
          <br />
          <span>made available.</span>
        </h1>
        <p>
          <strong>Single-host management page</strong> — password-protected. No
          visitor accounts.
        </p>
        <p>
          Scheduling timezone: <strong>{schedulingTimezone}</strong>. All
          entered dates and times use this timezone.
        </p>
      </header>
      <p className="muted device-timezone">
        Your browser timezone is {browserTimezone}. Scheduling still uses{' '}
        {schedulingTimezone}.
      </p>
      <div className="booking-layout host-layout">
        <section aria-labelledby="create-slot-title">
          <h2 id="create-slot-title" className="step-heading">
            <span>01</span> Publish a slot
          </h2>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <fieldset disabled={pending}>
              <legend className="sr-only">Slot details</legend>
              <label htmlFor="slot-date">Date (Europe/Skopje)</label>
              <input
                id="slot-date"
                type="date"
                required
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                  setOccurrence('')
                  setError('')
                  setCreated(null)
                }}
              />
              <label htmlFor="slot-time">Start time (Europe/Skopje)</label>
              <input
                id="slot-time"
                type="time"
                required
                step={60}
                value={time}
                onChange={(event) => {
                  setTime(event.target.value)
                  setOccurrence('')
                  setError('')
                  setCreated(null)
                }}
              />
              {timeError && (
                <p role="alert" className="error">
                  {timeError}
                </p>
              )}
              {options.length === 2 && (
                <>
                  <p id="occurrence-hint">
                    This time occurs twice when clocks move back. Choose which
                    occurrence you mean.
                  </p>
                  <label htmlFor="slot-occurrence">Time occurrence</label>
                  <select
                    id="slot-occurrence"
                    required
                    value={occurrence}
                    aria-describedby="occurrence-hint"
                    onChange={(event) => setOccurrence(event.target.value)}
                  >
                    <option value="">Choose an occurrence</option>
                    {options.map((option, index) => (
                      <option key={option.instant} value={option.instant}>
                        {index === 0 ? 'First' : 'Second'} occurrence (UTC
                        {option.offset})
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label htmlFor="slot-duration">Duration in minutes</label>
              <input
                id="slot-duration"
                type="number"
                required
                min={1}
                max={480}
                step={1}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
              <button type="submit" disabled={pending || !!timeError}>
                {pending ? 'Publishing…' : 'Publish slot'}{' '}
                <span aria-hidden="true">↗</span>
              </button>
            </fieldset>
          </form>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {created && (
            <p role="status" className="confirmation">
              Created: {slotDate(created.startsAt)},{' '}
              {slotTime(created.startsAt)} ({schedulingTimezone}) ·{' '}
              {created.durationMinutes} minutes.
            </p>
          )}
        </section>
        <section
          aria-labelledby="host-slots-title"
          aria-busy={loadState === 'loading'}
        >
          <h2 id="host-slots-title" className="step-heading">
            <span>02</span> Future available slots
          </h2>
          <p>
            This list shows only unbooked slots, not a complete booked schedule.
            It contains no attendee details.
          </p>
          {loadState === 'loading' && (
            <p role="status">Loading available slots…</p>
          )}
          {loadState === 'error' && (
            <p role="alert" className="error">
              Could not load availability. Check the API connection and retry.
            </p>
          )}
          {loadState === 'ready' && slots.length === 0 && (
            <div role="status" className="notice">
              <div>
                <h3>Make the first opening.</h3>
                <p>
                  No future available slots yet. Publish a time to make it
                  available for public booking.
                </p>
              </div>
            </div>
          )}
          {loadState === 'ready' && slots.length > 0 && (
            <ul className="availability-list">
              {[...slots]
                .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
                .map((slot) => (
                  <li key={slot.id}>
                    {slotDate(slot.startsAt)}
                    <br />
                    <time dateTime={slot.startsAt}>
                      {slotTime(slot.startsAt)}
                    </time>{' '}
                    · {slot.durationMinutes} minutes ({schedulingTimezone})
                  </li>
                ))}
            </ul>
          )}
          <button
            type="button"
            className="secondary"
            disabled={pending || loadState === 'loading'}
            onClick={refreshSlots}
          >
            {loadState === 'error'
              ? 'Retry loading availability'
              : 'Refresh available slots'}
          </button>
        </section>
      </div>
    </main>
  )
}
