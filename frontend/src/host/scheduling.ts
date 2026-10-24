import { Temporal } from '@js-temporal/polyfill'

export const schedulingTimezone = 'Europe/Skopje'

export function isFutureInstant(instant: string): boolean {
  return Date.parse(instant) > Date.now()
}

export interface TimeOption {
  instant: string
  offset: string
}

// Compare both DST interpretations with the requested local time. A gap maps
// to a different local time; an overlap maps to two different valid instants.
export function getTimeOptions(date: string, time: string): TimeOption[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('Enter a valid date and start time.')
  }
  let local: Temporal.PlainDateTime
  try {
    local = Temporal.PlainDateTime.from(`${date}T${time}`, {
      overflow: 'reject',
    })
  } catch {
    throw new Error('Enter a valid date and start time.')
  }
  const earlier = local.toZonedDateTime(schedulingTimezone, {
    disambiguation: 'earlier',
  })
  const later = local.toZonedDateTime(schedulingTimezone, {
    disambiguation: 'later',
  })
  if (
    !earlier.toPlainDateTime().equals(local) ||
    !later.toPlainDateTime().equals(local)
  ) {
    throw new Error(
      'This time does not exist in Europe/Skopje because the clocks move forward. Choose another time.',
    )
  }
  const candidates =
    earlier.epochNanoseconds === later.epochNanoseconds
      ? [earlier]
      : [earlier, later]
  return candidates.map((value) => ({
    instant: value.toInstant().toString(),
    offset: value.offset,
  }))
}
