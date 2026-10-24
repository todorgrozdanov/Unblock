import type { Slot } from './types'
import { slotDate, slotTime } from './time'
interface Props {
  slots: Slot[]
  selectedId: string
  disabled: boolean
  onSelect: (id: string) => void
}
export function SlotPicker({ slots, selectedId, disabled, onSelect }: Props) {
  const groups = new Map<string, Slot[]>()
  for (const slot of [...slots].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  )) {
    const date = slotDate(slot.startsAt)
    groups.set(date, [...(groups.get(date) ?? []), slot])
  }
  return (
    <fieldset disabled={disabled}>
      <legend>Choose one slot</legend>
      <p className="muted">All dates and times are shown in Europe/Skopje.</p>
      {[...groups].map(([date, group]) => (
        <section key={date}>
          <h3>{date}</h3>
          <div className="slot-options">
            {group.map((slot) => (
              <label key={slot.id} className="slot-option">
                <input
                  type="radio"
                  name="slot"
                  value={slot.id}
                  checked={slot.id === selectedId}
                  onChange={() => onSelect(slot.id)}
                />
                <span>
                  {slotTime(slot.startsAt)} · {slot.durationMinutes} minutes
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </fieldset>
  )
}
