import type { BookingDetails, Slot } from './types'
import { slotDate, slotTime } from './time'
interface Props {
  details: BookingDetails
  slot: Slot | undefined
  pending: boolean
  onChange: (details: BookingDetails) => void
  onSubmit: () => void
}
export function BookingForm({
  details,
  slot,
  pending,
  onChange,
  onSubmit,
}: Props) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <h2>Your details</h2>
      {slot ? (
        <p>
          Selected: {slotDate(slot.startsAt)}, {slotTime(slot.startsAt)} ·{' '}
          {slot.durationMinutes} minutes (Europe/Skopje)
        </p>
      ) : (
        <p>Select an available slot above to book.</p>
      )}
      <fieldset disabled={pending}>
        <legend className="sr-only">Booking details</legend>
        <label htmlFor="booking-name">Name</label>
        <input
          id="booking-name"
          name="name"
          autoComplete="name"
          required
          maxLength={100}
          value={details.name}
          onChange={(event) =>
            onChange({ ...details, name: event.target.value })
          }
        />
        <label htmlFor="booking-email">Email</label>
        <input
          id="booking-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={details.email}
          onChange={(event) =>
            onChange({ ...details, email: event.target.value })
          }
        />
        <label htmlFor="booking-task">Task description (optional)</label>
        <textarea
          id="booking-task"
          name="taskDescription"
          maxLength={2000}
          rows={4}
          aria-describedby="task-hint"
          value={details.taskDescription}
          onChange={(event) =>
            onChange({ ...details, taskDescription: event.target.value })
          }
        />
        <small id="task-hint">Up to 2,000 characters.</small>
        <button type="submit" disabled={!slot || pending}>
          {pending ? 'Booking…' : 'Book consultation'}
        </button>
      </fieldset>
    </form>
  )
}
