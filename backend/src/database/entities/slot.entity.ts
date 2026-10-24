import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('slots')
@Check('CHK_slots_duration_positive', '"durationMinutes" > 0')
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
