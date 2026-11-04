import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { lockSkills } from "../src/index.js";

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "schema", "skills.lock.schema.json");
const validate = new Ajv2020({ allErrors: true }).compile(JSON.parse(readFileSync(schemaPath, "utf8")));
const hash = "sha256-" + "a".repeat(64);

describe("lockfile JSON Schema", () => {
  it("accepts a lockfile written by lockSkills", () => {
    const root = mkdtempSync(join(tmpdir(), "sl-schema-"));
    mkdirSync(join(root, "team", "review"), { recursive: true });
    writeFileSync(join(root, "team", "review", "SKILL.md"), "# review");
    const lockPath = join(root, "skills.lock.json");
    lockSkills(root, lockPath);
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    expect(validate(lock), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each([
    ["an unknown version", { version: 2, skills: {} }],
    ["a malformed hash", { version: 1, skills: { review: "sha256-xyz" } }],
    ["a path climbing out of the skills folder", { version: 1, skills: { "../evil": hash } }],
    ["a Windows-style path", { version: 1, skills: { "team\\review": hash } }],
    ["an extra top-level key", { version: 1, skills: {}, note: "hi" }],
  ])("rejects %s", (_name, lock) => {
    expect(validate(lock)).toBe(false);
  });
});
