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
    if (response.status === 401)
      message = 'Host login is required or the session has expired.'
    if (response.status === 403)
      message =
        'Request verification failed. Reload the management page and sign in again.'
    if (response.status === 429)
      message =
        'Too many login attempts. Please wait up to 15 minutes before trying again.'
    if (response.status === 503)
      message = path.startsWith('/api/host/')
        ? 'Host access is unavailable. Check the backend host-password configuration.'
        : 'The service is temporarily unavailable. Your input is preserved; please try again later.'
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
export const createSlot = (
  startsAt: string,
  durationMinutes: number,
  signal: AbortSignal,
  csrfToken: string,
) =>
  request<Slot>('/api/slots', {
    method: 'POST',
    signal,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ startsAt, durationMinutes }),
  })

export interface HostSession {
  authenticated: boolean
  csrfToken: string
  expiresAt: string
}

export const getHostSession = (signal: AbortSignal) =>
  request<HostSession>('/api/host/session', {
    credentials: 'include',
    cache: 'no-store',
    signal,
  })

export const loginHost = (
  password: string,
  csrfToken: string,
  signal: AbortSignal,
) =>
  request<HostSession>('/api/host/login', {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ password }),
  })

export const logoutHost = (csrfToken: string, signal: AbortSignal) =>
  request<{ authenticated: false }>('/api/host/logout', {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: { 'X-CSRF-Token': csrfToken },
  })
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
