import { Temporal } from '@js-temporal/polyfill'

const zone = 'Europe/Skopje'

export function slotDateKey(startsAt: string): string {
  return Temporal.Instant.from(startsAt)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString()
}

export function currentMonth(): string {
  return Temporal.Now.plainDateISO(zone).with({ day: 1 }).toString()
}

export function monthStart(date: string): string {
  return Temporal.PlainDate.from(date).with({ day: 1 }).toString()
}

export function moveMonth(month: string, amount: number): string {
  return Temporal.PlainDate.from(month).add({ months: amount }).toString()
}

export function monthLabel(month: string): string {
  return Temporal.PlainDate.from(month).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

export function dateLabel(date: string): string {
  return Temporal.PlainDate.from(date).toLocaleString('en-GB', {
    dateStyle: 'full',
  })
}

export function monthCells(month: string): (string | null)[] {
  const first = Temporal.PlainDate.from(month).with({ day: 1 })
  const cells: (string | null)[] = Array(first.dayOfWeek - 1).fill(null)
  for (let day = 1; day <= first.daysInMonth; day++)
    cells.push(first.with({ day }).toString())
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
