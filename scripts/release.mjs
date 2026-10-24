// Run once per reviewed schema release, before deploying. No local .env loading.
// Production secrets are supplied by --env-file or the secure provider environment.
let database;
let lock;
try {
  if (process.env.NODE_ENV !== "production") throw new Error();
  const { validateProductionEnvironment } =
    await import("../backend/dist/production.js");
  validateProductionEnvironment();
  if (!process.env.DB_HOST?.endsWith(".neon.tech")) throw new Error();
  database = (await import("../backend/dist/database/data-source.js")).default;
  await database.initialize();
  lock = database.createQueryRunner();
  await lock.connect();
  await lock.query("SELECT pg_advisory_lock(1792800000)");
  const applied = await database.runMigrations({ transaction: "all" });
  console.log(
    `Migration release complete: ${applied.length} pending migration(s) applied.`,
  );
} catch {
  console.error(
    "Migration release failed. Check the dedicated Neon configuration and schema before retrying. Never reset or revert the database.",
  );
  process.exitCode = 1;
} finally {
  if (lock) {
    await lock.query("SELECT pg_advisory_unlock(1792800000)").catch(() => {});
    await lock.release();
  }
  if (database?.isInitialized) await database.destroy();
}
