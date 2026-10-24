// No migrations at startup: release.mjs is a separate, controlled operation.
process.env.NODE_ENV = "production";
process.env.SERVE_FRONTEND ??= "true";
try {
  await import("../backend/dist/main.js");
} catch {
  // Keep credentials, connection strings, and provider errors out of build logs.
  console.error(
    "Startup failed. Check production settings, database access, and the completed migration release.",
  );
  process.exitCode = 1;
}
