import { Check, Column, CreateDateColumn, Entity, Exclusion, PrimaryGeneratedColumn } from 'typeorm';

@Entity('slots')
@Check('CHK_slots_duration_positive', '"durationMinutes" > 0')
// UTC arithmetic measures elapsed minutes independently of database timezone/DST.
// [start, end) allows the next slot to start exactly when this one ends.
@Exclusion('EX_slots_no_overlap', `USING gist (tstzrange(
  "startsAt",
  (("startsAt" AT TIME ZONE 'UTC') + "durationMinutes" * INTERVAL '1 minute') AT TIME ZONE 'UTC',
  '[)'
) WITH &&)`)
export class Slot {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_slots' })
  id!: string;

  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'integer' })
  durationMinutes!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
