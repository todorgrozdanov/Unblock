export interface Slot {
  id: string
  startsAt: string
  durationMinutes: number
  createdAt: string
}
export interface BookingDetails {
  name: string
  email: string
  taskDescription: string
}
export interface BookingResponse {
  id: string
  name: string
  email: string
  taskDescription: string | null
  slot: Pick<Slot, 'id' | 'startsAt' | 'durationMinutes'>
}
