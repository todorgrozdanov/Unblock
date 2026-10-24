// Run manually in a private local terminal. Never print or upload the result.
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { hashHostPassword } from "../backend/dist/host-auth/password.js";

if (!process.stdin.isTTY) {
  console.error("Run this script directly in your local interactive terminal.");
  process.exit(1);
}
async function hiddenQuestion(prompt) {
  process.stdout.write(prompt);
  const output = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const reader = createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  reader.on("SIGINT", () => {
    reader.close();
    process.exit(130);
  });
  return new Promise((resolve) =>
    reader.question("", (answer) => {
      reader.close();
      process.stdout.write("\n");
      resolve(answer);
    }),
  );
}
const password = await hiddenQuestion(
  "Choose a NEW production host password (hidden): ",
);
const repeated = await hiddenQuestion("Repeat it (hidden): ");
if (password !== repeated || password.length < 12 || password.length > 256) {
  console.error("Passwords must match and contain 12-256 characters.");
  process.exit(1);
}
const template = await readFile(
  new URL("../backend/.env.production.example", import.meta.url),
  "utf8",
);
const content = template
  .replace(
    /^HOST_PASSWORD_HASH=$/m,
    `HOST_PASSWORD_HASH='${await hashHostPassword(password)}'`,
  )
  .replace(
    /^SESSION_SECRET=$/m,
    `SESSION_SECRET=${randomBytes(32).toString("hex")}`,
  );
try {
  await writeFile(
    new URL("../backend/.env.production", import.meta.url),
    content,
    {
      flag: "wx",
      mode: 0o600,
    },
  );
  console.log(
    "Created ignored backend/.env.production with new host credentials and session secret.",
  );
  console.log(
    "Complete its Neon and public-origin settings locally. Transfer values only into the provider secret dashboard.",
  );
} catch {
  console.error(
    "Could not create backend/.env.production; an existing file is never overwritten.",
  );
  process.exitCode = 1;
}
