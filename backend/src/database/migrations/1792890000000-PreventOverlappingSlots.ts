import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PreventOverlappingSlots1792890000000 implements MigrationInterface {
  name = 'PreventOverlappingSlots1792890000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM runs migrations in a transaction. Keep existing rows unchanged and
    // prevent writes between the overlap check and constraint creation.
    await queryRunner.query('LOCK TABLE "public"."slots" IN ACCESS EXCLUSIVE MODE');
    const [result] = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM "public"."slots" a JOIN "public"."slots" b ON a."id" < b."id"
        WHERE tstzrange(a."startsAt",
          ((a."startsAt" AT TIME ZONE 'UTC') + a."durationMinutes" * INTERVAL '1 minute') AT TIME ZONE 'UTC', '[)')
        && tstzrange(b."startsAt",
          ((b."startsAt" AT TIME ZONE 'UTC') + b."durationMinutes" * INTERVAL '1 minute') AT TIME ZONE 'UTC', '[)')
      ) AS overlaps
    `) as { overlaps: boolean }[];
    if (result.overlaps) {
      throw new Error('Existing slots overlap. Review them before running this migration; no slots were changed.');
    }
    await queryRunner.query(`
      ALTER TABLE "public"."slots" ADD CONSTRAINT "EX_slots_no_overlap"
      EXCLUDE USING gist (tstzrange(
        "startsAt",
        (("startsAt" AT TIME ZONE 'UTC') + "durationMinutes" * INTERVAL '1 minute') AT TIME ZONE 'UTC',
        '[)'
      ) WITH &&)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "public"."slots" DROP CONSTRAINT "EX_slots_no_overlap"');
  }
}
