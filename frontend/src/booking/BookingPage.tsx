import { useEffect, useRef, useState } from 'react'
import { ApiError, createBooking, getSlots } from './api'
import type { BookingDetails, BookingResponse, Slot } from './types'
import { SlotPicker } from './SlotPicker'
import { BookingForm } from './BookingForm'
import { BookingConfirmation } from './BookingConfirmation'
import { Hero } from '../landing/Hero'

const emptyDetails: BookingDetails = {
  name: '',
  email: '',
  taskDescription: '',
}
export function BookingPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [refresh, setRefresh] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [details, setDetails] = useState<BookingDetails>(emptyDetails)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<BookingResponse | null>(null)
  const submission = useRef<AbortController | null>(null)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const errorMessage = useRef<HTMLParagraphElement>(null)
  const selectedSlot = slots.find((slot) => slot.id === selectedId)
  const step = confirmation ? 'confirmed' : selectedSlot ? 'details' : 'choose'
  const previousStep = useRef(step)

  // Focus only on a step change, so loading and clock ticks never steal focus.
  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus()
    previousStep.current = step
  }, [step])

  useEffect(() => {
    if (error && step === 'details') errorMessage.current?.focus()
  }, [error, step])

  function bookAnother() {
    setDetails(emptyDetails)
    setConfirmation(null)
    setSelectedId('')
    setError('')
    refreshSlots()
  }
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
    <main className="booking-page">
      <Hero />
      <section
        className="booking-section"
        id="booking-panel"
        aria-labelledby="booking-title"
        tabIndex={-1}
      >
        <header className="booking-intro">
          <div>
            <p className="eyebrow">ONE TASK. A FRESH PERSPECTIVE.</p>
            <h2 id="booking-title">
              A little time.
              <br />
              <span>A new direction.</span>
            </h2>
          </div>
          <p>
            Choose a session to explore a repetitive task together.
            <br />
            All session times are shown in Europe/Skopje.
          </p>
        </header>
        <ol className="booking-progress" aria-label="Booking progress">
          {['Choose date & time', 'Your details', 'Confirmation'].map(
            (label, index) => {
              const current = step === 'choose' ? 0 : step === 'details' ? 1 : 2
              return (
                <li
                  key={label}
                  aria-current={current === index ? 'step' : undefined}
                  className={index < current ? 'completed' : ''}
                >
                  <span>{index < current ? '✓' : `0${index + 1}`}</span>
                  {label}
                </li>
              )
            },
          )}
        </ol>
        {confirmation ? (
          <BookingConfirmation
            booking={confirmation}
            onBookAnother={bookAnother}
          />
        ) : (
          <div className="booking-step">
            <h3 ref={stepHeading} tabIndex={-1} className="step-title">
              {step === 'choose'
                ? 'Choose your date and time.'
                : 'Tell us what’s on repeat.'}
            </h3>
            {error && (
              <p
                role="alert"
                className="error"
                ref={errorMessage}
                tabIndex={-1}
              >
                {error}
              </p>
            )}
            {step === 'choose' ? (
              <section
                aria-label="Available consultations"
                aria-busy={loadState === 'loading'}
              >
                {loadState === 'loading' && (
                  <div className="notice" role="status">
                    <span className="notice-symbol" aria-hidden="true">
                      ↗
                    </span>
                    <div>
                      <h4>Finding your next opening.</h4>
                      <p>Loading available sessions…</p>
                    </div>
                  </div>
                )}
                {loadState === 'error' && (
                  <div className="notice notice-error" role="alert">
                    <span className="notice-symbol" aria-hidden="true">
                      !
                    </span>
                    <div>
                      <h4>We couldn’t load the times.</h4>
                      <p>
                        Check your connection and that the API is running, then
                        try again.
                      </p>
                    </div>
                  </div>
                )}
                {loadState === 'ready' && slots.length === 0 && (
                  <div className="notice" role="status">
                    <span className="notice-symbol" aria-hidden="true">
                      ↗
                    </span>
                    <div>
                      <h4>A little breathing room.</h4>
                      <p>
                        No sessions are available right now. Check again later
                        or refresh the list.
                      </p>
                    </div>
                  </div>
                )}
                {loadState === 'ready' && slots.length > 0 && (
                  <SlotPicker
                    slots={slots}
                    selectedId={selectedId}
                    disabled={pending}
                    onSelect={(id) => {
                      setSelectedId(id)
                      setError('')
                    }}
                  />
                )}
                <button
                  type="button"
                  className="secondary refresh-button"
                  disabled={pending || loadState === 'loading'}
                  onClick={refreshSlots}
                >
                  {loadState === 'error'
                    ? 'Retry loading slots'
                    : 'Refresh slots'}{' '}
                  <span aria-hidden="true">↻</span>
                </button>
              </section>
            ) : (
              selectedSlot && (
                <BookingForm
                  details={details}
                  pending={pending}
                  slot={selectedSlot}
                  onChange={setDetails}
                  onSubmit={() => void submit()}
                  onBack={() => {
                    setSelectedId('')
                    setError('')
                  }}
                />
              )
            )}
          </div>
        )}
      </section>
      <footer className="page-footer">
        <span>unblock. / AUTOMATION CLINIC</span>
        <span>Less repetition. More possibility.</span>
      </footer>
    </main>
  )
}
