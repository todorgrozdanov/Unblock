import { useState } from 'react'
import type { Slot } from './types'
import { slotTime } from './time'
import { dateLabel, slotDateKey } from './calendar'
import { MonthCalendar } from './MonthCalendar'

interface Props {
  slots: Slot[]
  selectedId: string
  disabled: boolean
  onSelect: (id: string) => void
}

export function SlotPicker({ slots, selectedId, disabled, onSelect }: Props) {
  const ordered = [...slots].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  )
  const initialSlot =
    ordered.find((slot) => slot.id === selectedId) ?? ordered[0]
  const [selectedDate, setSelectedDate] = useState(() =>
    initialSlot ? slotDateKey(initialSlot.startsAt) : '',
  )
  const availableDates = new Set(
    ordered.map((slot) => slotDateKey(slot.startsAt)),
  )
  const dateSlots = ordered.filter(
    (slot) => slotDateKey(slot.startsAt) === selectedDate,
  )
  const offset = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Skopje',
    timeZoneName: 'shortOffset',
  })

  return (
    <div className="slot-picker">
      <p className="timezone-note">
        All sessions are scheduled in <strong>Europe/Skopje</strong>.
      </p>
      <MonthCalendar
        availableDates={availableDates}
        selectedDate={selectedDate}
        initialDate={selectedDate}
        disabled={disabled}
        onSelectDate={(date) => {
          setSelectedDate(date)
          onSelect('')
        }}
      />
      <fieldset className="time-picker" disabled={disabled}>
        <legend>
          {selectedDate ? dateLabel(selectedDate) : 'Choose an available date'}
        </legend>
        <div className="time-options">
          {dateSlots.map((slot) => (
            <button
              type="button"
              className="time-option"
              key={slot.id}
              aria-pressed={slot.id === selectedId}
              onClick={() => onSelect(slot.id)}
            >
              <span>{slotTime(slot.startsAt)}</span>
              <small>{slot.durationMinutes} min</small>
              {dateSlots.some(
                (other) =>
                  other.id !== slot.id &&
                  slotTime(other.startsAt) === slotTime(slot.startsAt),
              ) && (
                <small>
                  {
                    offset
                      .formatToParts(new Date(slot.startsAt))
                      .find((part) => part.type === 'timeZoneName')?.value
                  }
                </small>
              )}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
