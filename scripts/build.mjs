import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
function npm(directory, args, env = process.env) {
  const windows = process.platform === "win32";
  const result = spawnSync(
    windows ? process.execPath : "npm",
    windows
      ? [
          join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
          ...args,
        ]
      : args,
    {
      cwd: `${root}/${directory}`,
      stdio: "inherit",
      env,
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (process.argv.includes("--install")) {
  npm("frontend", ["ci", "--include=dev"]);
  npm("backend", ["ci", "--include=dev"]);
}
// This value is public and intentionally empty: API requests use this origin.
npm("frontend", ["run", "build"], { ...process.env, VITE_API_URL: "" });
npm("backend", ["run", "build"]);
if (process.argv.includes("--prune")) npm("backend", ["prune", "--omit=dev"]);
