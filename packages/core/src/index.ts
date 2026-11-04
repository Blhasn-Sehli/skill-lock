import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const posix = (p: string) => p.split("\\").join("/");

/** Files under dir, sorted. Symlinks are listed, never followed, so a skill cannot pull in files outside itself. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    lstatSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

/** File bytes for hashing; text files get LF line endings so Windows (CRLF) and Linux checkouts hash the same. */
function contentOf(file: string): Buffer {
  const st = lstatSync(file);
  if (st.isSymbolicLink()) return Buffer.from(`symlink:${posix(readlinkSync(file))}`);
  const buf = readFileSync(file);
  return buf.includes(0) ? buf : Buffer.from(buf.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
}

/** Deterministic sha256 of a skill folder: path + content of every file, sorted. */
export function hashSkill(dir: string): string {
  const h = createHash("sha256");
  for (const f of walk(dir)) {
    h.update(posix(relative(dir, f)) + "\0");
    h.update(contentOf(f));
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

/** Every folder under root that holds a SKILL.md, keyed by its posix path from root. Skills are not searched inside. */
export function findSkills(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (dir: string) => {
    if (existsSync(join(dir, "SKILL.md"))) {
      out[posix(relative(root, dir)) || "."] = dir;
      return;
    }
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (!name.startsWith(".") && name !== "node_modules" && lstatSync(p).isDirectory()) visit(p);
    }
  };
  visit(root);
  return out;
}

export interface LockDiff { added: string[]; removed: string[]; changed: string[]; unchanged: string[] }

export function diffLock(locked: Lock, current: Lock): LockDiff {
  const names = [...new Set([...Object.keys(locked), ...Object.keys(current)])].sort();
  const d: LockDiff = { added: [], removed: [], changed: [], unchanged: [] };
  for (const n of names) {
    if (!(n in locked)) d.added.push(n);
    else if (!(n in current)) d.removed.push(n);
    else if (locked[n] !== current[n]) d.changed.push(n);
    else d.unchanged.push(n);
  }
  return d;
}

export const LOCKFILE_SCHEMA_URL = "https://raw.githubusercontent.com/Blhasn-Sehli/skill-lock/main/schema/skills.lock.schema.json";

export interface LockFile { $schema?: string; version: 1; skills: Lock }

function readLockFile(path: string): LockFile | undefined {
  if (!existsSync(path)) return undefined;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as LockFile;
  if (parsed.version !== 1 || typeof parsed.skills !== "object") throw new Error(`${path} is not a skill-lock v1 lockfile`);
  return parsed;
}

const hasChanges = (d: LockDiff) => d.added.length + d.removed.length + d.changed.length > 0;

/**
 * Hash every skill under root into the lockfile. When a lockfile already exists and skills changed,
 * nothing is written unless `update` is set, so a change is never accepted silently.
 */
export function lockSkills(root: string, lockPath: string, opts: { update?: boolean } = {}): { written: boolean; diff: LockDiff } {
  const current = createLock(findSkills(root));
  const previous = readLockFile(lockPath);
  const diff = diffLock(previous?.skills ?? {}, current);
  if (previous && hasChanges(diff) && !opts.update) return { written: false, diff };
  const file: LockFile = { $schema: LOCKFILE_SCHEMA_URL, version: 1, skills: Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b))) };
  writeFileSync(lockPath, JSON.stringify(file, null, 2) + "\n");
  return { written: true, diff };
}

/** Compare skills on disk with the lockfile; ok only when nothing was added, removed or changed. */
export function verifySkills(root: string, lockPath: string): { ok: boolean; diff?: LockDiff; error?: string } {
  const locked = readLockFile(lockPath);
  if (!locked) return { ok: false, error: `no lockfile at ${lockPath}; run "skill-lock lock" first` };
  const diff = diffLock(locked.skills, createLock(findSkills(root)));
  return { ok: !hasChanges(diff), diff };
}
