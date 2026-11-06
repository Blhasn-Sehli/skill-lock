import { findSkills, lockSkills, verifySkills, type LockDiff } from "@skill-lock/core";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

/** Where skills usually live, in the order they are tried. */
export const SKILL_DIRS = [".claude/skills", ".agents/skills", "skills"] as const;

export const LOCKFILE = "skills.lock.json";
export const WORKFLOW = ".github/workflows/skill-lock.yml";

const posix = (p: string) => p.split("\\").join("/");
const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

export interface Detected { dir: string; others: string[] }

/**
 * The first usual folder that holds at least one skill (a folder with a SKILL.md), else the first
 * one that exists. `others` lists further usual folders that also hold skills.
 */
export function detectSkillsDir(cwd: string): Detected | undefined {
  const existing = SKILL_DIRS.filter((d) => isDir(join(cwd, d)));
  const withSkills = existing.filter((d) => Object.keys(findSkills(join(cwd, d))).length > 0);
  const dir = withSkills[0] ?? existing[0];
  return dir ? { dir, others: withSkills.filter((d) => d !== dir) } : undefined;
}

/** The CI workflow `init` writes. The folder goes through an env var, so no path is ever pasted into a shell command. */
export function workflowYaml(dir: string, version: string): string {
  const run = `npx --yes @mpkk/skill-lock@${version}`;
  return `# Written by "skill-lock init". Fails a pull request when a skill changed without an updated
# skills.lock.json, and scans skills for remote code, secrets, suspicious hosts and hidden Unicode.
# The CLI version is pinned on purpose; bump it here to upgrade.
name: skill-lock
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  skill-lock:
    runs-on: ubuntu-latest
    env:
      SKILLS_DIR: ${JSON.stringify(dir)}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Verify skills match skills.lock.json
        run: ${run} verify "$SKILLS_DIR"
      - name: Scan skills
        if: success() || failure()
        run: ${run} scan "$SKILLS_DIR"
`;
}

export interface InitOptions {
  cwd: string;
  dir?: string;
  ci?: boolean;
  version: string;
  log?: (line: string) => void;
}

const changes = (d: LockDiff) => [
  ...d.changed.map((n) => `  changed  ${n}`),
  ...d.added.map((n) => `  added    ${n}`),
  ...d.removed.map((n) => `  removed  ${n}`),
];

/**
 * Set up skill-lock in a repository: find the skills folder, write skills.lock.json and the CI
 * workflow. Safe to run again: existing files are kept, and a lockfile that no longer matches is
 * reported, never overwritten. Returns the exit code.
 */
export function runInit(opts: InitOptions): number {
  const log = opts.log ?? console.log;
  const { cwd } = opts;

  let dir: string;
  if (opts.dir) {
    const abs = resolve(cwd, opts.dir);
    if (!isDir(abs)) {
      log(`No such folder: ${opts.dir}`);
      return 1;
    }
    const rel = posix(relative(cwd, abs));
    if (rel.startsWith("..") || isAbsolute(rel)) {
      log(`The skills folder must be inside the current folder (run init from the repository root): ${opts.dir}`);
      return 1;
    }
    dir = rel || ".";
  } else {
    const found = detectSkillsDir(cwd);
    if (!found) {
      log(`No skills folder found (looked for ${SKILL_DIRS.join(", ")}).`);
      log("Pass the folder that holds your skills: npx @mpkk/skill-lock init --dir <folder>");
      return 1;
    }
    dir = found.dir;
    if (found.others.length) log(`Also found skills in ${found.others.join(", ")}; using ${dir} (pick another with --dir).`);
  }

  const root = join(cwd, dir);
  const lockPath = join(cwd, LOCKFILE);
  const count = Object.keys(findSkills(root)).length;
  log(`Skills folder: ${dir} (${count} skill${count === 1 ? "" : "s"})`);
  if (count === 0) log("  No SKILL.md found yet; the lockfile will be empty until you add a skill and run \"skill-lock lock --update\".");

  let code = 0;
  if (!existsSync(lockPath)) {
    lockSkills(root, lockPath);
    log(`  wrote    ${LOCKFILE}`);
  } else {
    const result = verifySkills(root, lockPath);
    if (result.ok) log(`  ok       ${LOCKFILE} (already matches)`);
    else {
      log(`  kept     ${LOCKFILE}, but skills changed since it was written:`);
      for (const line of changes(result.diff!)) log(`  ${line}`);
      code = 1;
    }
  }

  const workflowPath = join(cwd, WORKFLOW);
  if (opts.ci === false) log(`  skipped  ${WORKFLOW} (--no-ci)`);
  else if (existsSync(workflowPath)) log(`  kept     ${WORKFLOW} (already exists)`);
  else {
    mkdirSync(join(cwd, ".github", "workflows"), { recursive: true });
    writeFileSync(workflowPath, workflowYaml(dir, opts.version));
    log(`  wrote    ${WORKFLOW}`);
  }

  log("");
  if (code !== 0) {
    log(`Next: review the changes above, then accept them with: npx @mpkk/skill-lock lock ${dir} --update`);
  } else {
    const files = opts.ci === false ? LOCKFILE : `${LOCKFILE} ${WORKFLOW}`;
    log(`Next: commit the lockfile${opts.ci === false ? "" : " and workflow"}: git add ${files} && git commit -m "Lock agent skills"`);
  }
  return code;
}
