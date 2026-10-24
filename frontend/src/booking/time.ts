const date = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Skopje',
  dateStyle: 'full',
})
const time = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Skopje',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
export const slotDate = (startsAt: string) => date.format(new Date(startsAt))
export const slotTime = (startsAt: string) => time.format(new Date(startsAt))
