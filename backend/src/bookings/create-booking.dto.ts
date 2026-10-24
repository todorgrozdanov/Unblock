import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  slotId!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  taskDescription?: string;
}
