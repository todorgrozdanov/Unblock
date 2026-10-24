import type { BookingDetails, Slot } from './types'
import { slotDate, slotTime } from './time'
interface Props {
  details: BookingDetails
  slot: Slot
  pending: boolean
  onChange: (details: BookingDetails) => void
  onSubmit: () => void
  onBack: () => void
}
export function BookingForm({
  details,
  slot,
  pending,
  onChange,
  onSubmit,
  onBack,
}: Props) {
  return (
    <div className="details-layout">
      <aside className="session-summary" aria-label="Selected session">
        <p className="eyebrow">YOUR SESSION</p>
        <h4>{slotDate(slot.startsAt)}</h4>
        <p className="summary-time">
          {slotTime(slot.startsAt)} <span>↗</span>
        </p>
        <p>{slot.durationMinutes} minutes · Europe/Skopje</p>
        <p className="summary-note">
          Bring one repetitive task. We’ll explore possible approaches together.
        </p>
        <button
          type="button"
          className="secondary"
          disabled={pending}
          onClick={onBack}
        >
          ← Back to times
        </button>
      </aside>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <fieldset disabled={pending}>
          <legend className="sr-only">Booking details</legend>
          <p className="form-intro">
            A few details for your consultation. No account needed.
          </p>
          <div className="form-columns">
            <div>
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
            </div>
            <div>
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
            </div>
          </div>
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
          <button type="submit" disabled={pending}>
            {pending ? 'Booking…' : 'Book consultation'}{' '}
            <span aria-hidden="true">↗</span>
          </button>
        </fieldset>
      </form>
    </div>
  )
}
