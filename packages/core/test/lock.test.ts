import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLock, hashSkill, verifyLock } from "../src/index.js";

function skill(body: string) {
  const d = mkdtempSync(join(tmpdir(), "sl-"));
  mkdirSync(join(d, "sub"));
  writeFileSync(join(d, "SKILL.md"), body);
  writeFileSync(join(d, "sub", "x.sh"), "echo hi");
  return d;
}

describe("skill-lock", () => {
  it("is deterministic", () => {
    expect(hashSkill(skill("a"))).toBe(hashSkill(skill("a")));
  });
  it("detects a changed file", () => {
    const d = skill("a");
    const lock = createLock({ s: d });
    writeFileSync(join(d, "SKILL.md"), "a + injected instructions");
    expect(verifyLock(lock, { s: d })[0].ok).toBe(false);
  });
});
