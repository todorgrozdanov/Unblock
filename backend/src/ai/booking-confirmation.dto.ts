import { IsUUID } from 'class-validator';

export class BookingConfirmationDto {
  @IsUUID()
  bookingId!: string;
}
