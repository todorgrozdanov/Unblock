import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, Unique,
} from 'typeorm';
import { Slot } from './slot.entity.js';

@Entity('bookings')
@Unique('UQ_bookings_slotId', ['slotId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_bookings' })
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'text', nullable: true })
  taskDescription!: string | null;

  @Column({ type: 'uuid' })
  slotId!: string;

  @ManyToOne(() => Slot, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'slotId', foreignKeyConstraintName: 'FK_bookings_slotId' })
  slot!: Slot;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
