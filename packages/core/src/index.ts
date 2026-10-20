import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

/** Deterministic sha256 of a skill folder: path + content of every file, sorted. */
export function hashSkill(dir: string): string {
  const h = createHash("sha256");
  for (const f of walk(dir)) {
    h.update(relative(dir, f).split("\\").join("/") + "\0");
    h.update(readFileSync(f));
    h.update("\0");
  }
  return "sha256-" + h.digest("hex");
}

export type Lock = Record<string, string>;

export function createLock(skills: Record<string, string>): Lock {
  return Object.fromEntries(Object.entries(skills).map(([n, d]) => [n, hashSkill(d)]));
}

export function verifyLock(lock: Lock, skills: Record<string, string>) {
  return Object.keys(lock).map((name) => {
    const dir = skills[name];
    const actual = dir ? hashSkill(dir) : undefined;
    return { name, ok: actual === lock[name], expected: lock[name], actual };
  });
}
