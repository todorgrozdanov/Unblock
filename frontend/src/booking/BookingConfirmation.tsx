import { useEffect, useRef } from 'react'
import type { BookingResponse } from './types'
import { slotDate, slotTime } from './time'
export function BookingConfirmation({
  booking,
  onBookAnother,
}: {
  booking: BookingResponse
  onBookAnother: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [booking.id])
  return (
    <section
      className="booking-confirmation"
      aria-labelledby="confirmation-title"
    >
      <div className="confirmation-symbol" aria-hidden="true">
        ↗
      </div>
      <div>
        <p className="eyebrow">A NEW DIRECTION STARTS HERE</p>
        <h3 id="confirmation-title" tabIndex={-1} ref={heading}>
          You’re booked.
        </h3>
        <p className="confirmation-thanks">{booking.confirmationMessage}</p>
        {booking.confirmationMessageSource === 'ai' && (
          <p className="muted">
            AI-generated welcome and preparation note · Session details verified
            by Unblock
          </p>
        )}
        <dl className="confirmation-details">
          <div>
            <dt>Session</dt>
            <dd>
              {slotDate(booking.slot.startsAt)}
              <br />
              {slotTime(booking.slot.startsAt)} · {booking.slot.durationMinutes}{' '}
              minutes
              <br />
              <span>Europe/Skopje</span>
            </dd>
          </div>
          <div>
            <dt>Your details</dt>
            <dd>
              {booking.name}
              <br />
              {booking.email}
            </dd>
          </div>
          {booking.taskDescription && (
            <div className="confirmation-task">
              <dt>Your task</dt>
              <dd className="preserve-lines">{booking.taskDescription}</dd>
            </div>
          )}
        </dl>
        <p className="reference">Booking reference: {booking.id}</p>
        <button type="button" onClick={onBookAnother}>
          Book another session <span aria-hidden="true">↗</span>
        </button>
      </div>
    </section>
  )
}
