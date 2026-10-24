import { IsDateString, IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class CreateSlotDto {
  @IsString()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i, {
    message: 'startsAt must be an ISO 8601 date-time with Z or a numeric timezone offset',
  })
  startsAt!: string;

  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes!: number;
}
