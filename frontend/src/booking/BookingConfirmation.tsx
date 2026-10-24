import { useEffect, useRef } from 'react'
import type { BookingResponse } from './types'
import { slotDate, slotTime } from './time'
export function BookingConfirmation({ booking }: { booking: BookingResponse }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [booking.id])
  return (
    <section className="confirmation" aria-labelledby="confirmation-title">
      <h2 id="confirmation-title" tabIndex={-1} ref={heading}>
        Booking confirmed
      </h2>
      <p>Thank you, {booking.name}.</p>
      <p>
        {slotDate(booking.slot.startsAt)}, {slotTime(booking.slot.startsAt)}{' '}
        (Europe/Skopje)
      </p>
      <p>Duration: {booking.slot.durationMinutes} minutes</p>
      <p>Email: {booking.email}</p>
      {booking.taskDescription && (
        <p className="preserve-lines">Task: {booking.taskDescription}</p>
      )}
      <p className="reference">Booking reference: {booking.id}</p>
    </section>
  )
}
