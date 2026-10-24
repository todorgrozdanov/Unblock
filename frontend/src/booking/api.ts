import type { BookingDetails, BookingResponse, Slot } from './types'
const baseUrl = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
async function request<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, options)
  if (!response.ok) {
    let message = 'The request failed. Please try again.'
    if (response.status === 400) {
      const body: unknown = await response.json().catch(() => null)
      if (body && typeof body === 'object' && 'message' in body) {
        if (typeof body.message === 'string') message = body.message
        else if (Array.isArray(body.message))
          message = body.message
            .filter((item): item is string => typeof item === 'string')
            .join('. ')
      }
    }
    throw new ApiError(response.status, message)
  }
  return response.json() as Promise<T>
}
export const getSlots = (signal: AbortSignal) =>
  request<Slot[]>('/api/slots', { signal })
export const createBooking = (
  slotId: string,
  details: BookingDetails,
  signal: AbortSignal,
) =>
  request<BookingResponse>('/api/bookings', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slotId,
      name: details.name.trim(),
      email: details.email,
      ...(details.taskDescription
        ? { taskDescription: details.taskDescription }
        : {}),
    }),
  })
