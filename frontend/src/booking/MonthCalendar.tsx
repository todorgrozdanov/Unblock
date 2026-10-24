import { useRef, useState } from 'react'
import {
  currentMonth,
  dateLabel,
  monthCells,
  monthLabel,
  monthStart,
  moveMonth,
} from './calendar'

interface Props {
  availableDates: Set<string>
  selectedDate: string
  initialDate: string
  disabled: boolean
  onSelectDate: (date: string) => void
}

export function MonthCalendar({
  availableDates,
  selectedDate,
  initialDate,
  disabled,
  onSelectDate,
}: Props) {
  const [month, setMonth] = useState(() =>
    initialDate ? monthStart(initialDate) : currentMonth(),
  )
  const days = monthCells(month)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const enabledDates = days.filter(
    (day): day is string => day !== null && availableDates.has(day),
  )

  function navigate(amount: number) {
    setMonth((value) => moveMonth(value, amount))
    onSelectDate('')
  }

  return (
    <div className="month-calendar">
      <div className="month-navigation">
        <h3 aria-live="polite">{monthLabel(month)}</h3>
        <div className="month-arrows">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous month"
            disabled={disabled}
            onClick={() => navigate(-1)}
          >
            ←
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Next month"
            disabled={disabled}
            onClick={() => navigate(1)}
          >
            →
          </button>
        </div>
      </div>
      <table
        className="calendar-table"
        aria-label={`${monthLabel(month)} availability`}
      >
        <thead>
          <tr>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <th scope="col" key={day}>
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days.length / 7 }, (_, week) => (
            <tr key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day, index) => (
                <td key={day ?? `blank-${index}`}>
                  {day && (
                    <button
                      type="button"
                      className="calendar-day"
                      disabled={disabled || !availableDates.has(day)}
                      ref={(element) => {
                        if (element) buttons.current.set(day, element)
                        else buttons.current.delete(day)
                      }}
                      aria-label={dateLabel(day)}
                      aria-pressed={day === selectedDate}
                      onClick={() => onSelectDate(day)}
                      onKeyDown={(event) => {
                        const position = enabledDates.indexOf(day)
                        let next = position
                        if (
                          event.key === 'ArrowRight' ||
                          event.key === 'ArrowDown'
                        )
                          next++
                        else if (
                          event.key === 'ArrowLeft' ||
                          event.key === 'ArrowUp'
                        )
                          next--
                        else if (event.key === 'Home') next = 0
                        else if (event.key === 'End')
                          next = enabledDates.length - 1
                        else return
                        event.preventDefault()
                        const target =
                          enabledDates[
                            Math.max(0, Math.min(next, enabledDates.length - 1))
                          ]
                        if (target) buttons.current.get(target)?.focus()
                      }}
                    >
                      {Number(day.slice(-2))}
                      <span className="availability-dot" aria-hidden="true" />
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="calendar-key">
        <span aria-hidden="true" />
        Highlighted dates have available sessions.
      </p>
    </div>
  )
}
