// One-file build for npm: the CLI and @skill-lock/core in a single script with no runtime
// dependencies (core only uses Node built-ins). README and LICENSE are copied from the repo root
// so the npm page matches GitHub.
import { build } from "esbuild";
import { copyFileSync } from "node:fs";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/skill-lock.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "warning",
});
copyFileSync("../../LICENSE", "LICENSE");
copyFileSync("../../README.md", "README.md");
