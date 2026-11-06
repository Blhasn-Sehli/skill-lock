import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const cliDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(cliDir, "..", "..");
const pkg = JSON.parse(readFileSync(join(cliDir, "package.json"), "utf8"));
const bundle = join(cliDir, "dist", "skill-lock.js");
const run = (...args: string[]) => spawnSync(process.execPath, [bundle, ...args], { encoding: "utf8" });

describe("npm package", () => {
  it("publishes one file with no runtime dependencies", () => {
    expect(pkg.name).toBe("@mpkk/skill-lock");
    expect(pkg.bin).toEqual({ "skill-lock": "dist/skill-lock.js" });
    expect(pkg.dependencies ?? {}).toEqual({});
    expect(pkg.engines.node).toBe(">=22");
  });

  it("pins the same CLI version in action.yml", () => {
    const action = parse(readFileSync(join(repoRoot, "action.yml"), "utf8"));
    expect(action.runs.using).toBe("composite");
    expect(Object.keys(action.inputs)).toEqual(["dir", "scan"]);
    for (const step of action.runs.steps.filter((s: { run?: string }) => s.run)) {
      expect(step.env.SKILL_LOCK_VERSION).toBe(pkg.version);
    }
  });
});

describe.runIf(existsSync(bundle))("bundled CLI", () => {
  it("shows short help with no arguments and with --help", () => {
    for (const args of [[], ["--help"]]) {
      const r = run(...args);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("npx @mpkk/skill-lock init");
    }
  });
  it("prints its version", () => {
    expect(run("--version").stdout.trim()).toBe(pkg.version);
  });
  it("rejects an unknown command", () => {
    expect(run("nope").status).toBe(1);
  });
});
