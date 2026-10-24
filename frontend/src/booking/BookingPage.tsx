import { useEffect, useRef, useState } from 'react'
import { ApiError, createBooking, getSlots } from './api'
import type { BookingDetails, BookingResponse, Slot } from './types'
import { SlotPicker } from './SlotPicker'
import { BookingForm } from './BookingForm'
import { BookingConfirmation } from './BookingConfirmation'
export function BookingPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [refresh, setRefresh] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [details, setDetails] = useState<BookingDetails>({
    name: '',
    email: '',
    taskDescription: '',
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<BookingResponse | null>(null)
  const submission = useRef<AbortController | null>(null)
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
        setSelectedId((current) =>
          available.some((slot) => slot.id === current) ? current : '',
        )
        setLoadState('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState('error')
      })
    return () => controller.abort()
  }, [refresh])
  async function submit() {
    if (submission.current || !selectedId || loadState !== 'ready') return
    if (!details.name.trim()) {
      setError('Please enter your name.')
      return
    }
    const controller = new AbortController()
    submission.current = controller
    setPending(true)
    setError('')
    try {
      const result = await createBooking(selectedId, details, controller.signal)
      if (controller.signal.aborted) return
      setConfirmation(result)
      setSelectedId('')
      refreshSlots()
    } catch (failure) {
      if (controller.signal.aborted) return
      if (failure instanceof ApiError && failure.status === 409) {
        setError(
          'That slot is no longer available. Your details are saved here; please choose another slot.',
        )
        setSelectedId('')
        refreshSlots()
      } else {
        setError(
          failure instanceof ApiError
            ? failure.message
            : 'We could not confirm your booking. Your details are still here. Check your connection and try again; a previous request may have reached the server.',
        )
      }
    } finally {
      submission.current = null
      if (!controller.signal.aborted) setPending(false)
    }
  }
  return (
    <main>
      <header>
        <h1>Unblock — Automation Clinic</h1>
        <p>Choose a time to discuss your automation task.</p>
      </header>
      {confirmation && <BookingConfirmation booking={confirmation} />}
      <div className="booking-layout">
        <section
          aria-labelledby="availability-title"
          aria-busy={loadState === 'loading'}
        >
          <h2 id="availability-title">Available consultations</h2>
          {loadState === 'loading' && (
            <p role="status">Loading available slots…</p>
          )}
          {loadState === 'error' && (
            <p role="alert">
              Could not load available slots. Check that the API is running and
              try again.
            </p>
          )}
          {loadState === 'ready' && slots.length === 0 && (
            <p role="status">
              No slots are available right now. Please check again later.
            </p>
          )}
          {loadState === 'ready' && slots.length > 0 && (
            <SlotPicker
              slots={slots}
              selectedId={selectedId}
              disabled={pending}
              onSelect={(id) => {
                setSelectedId(id)
                setError('')
                setConfirmation(null)
              }}
            />
          )}
          <button
            type="button"
            className="secondary"
            disabled={pending || loadState === 'loading'}
            onClick={refreshSlots}
          >
            {loadState === 'error' ? 'Retry loading slots' : 'Refresh slots'}
          </button>
        </section>
        <section aria-label="Book a consultation">
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <BookingForm
            details={details}
            pending={pending}
            slot={
              loadState === 'ready'
                ? slots.find((slot) => slot.id === selectedId)
                : undefined
            }
            onChange={setDetails}
            onSubmit={() => void submit()}
          />
        </section>
      </div>
    </main>
  )
}
