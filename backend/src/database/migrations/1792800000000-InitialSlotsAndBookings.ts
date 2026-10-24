import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSlotsAndBookings1792800000000 implements MigrationInterface {
  name = 'InitialSlotsAndBookings1792800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "public"."slots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "startsAt" timestamptz NOT NULL,
        "durationMinutes" integer NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_slots" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_slots_duration_positive" CHECK ("durationMinutes" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "public"."bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "email" varchar NOT NULL,
        "taskDescription" text,
        "slotId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bookings_slotId" UNIQUE ("slotId"),
        CONSTRAINT "FK_bookings_slotId" FOREIGN KEY ("slotId")
          REFERENCES "public"."slots" ("id") ON DELETE RESTRICT
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "public"."bookings"');
    await queryRunner.query('DROP TABLE "public"."slots"');
  }
}
