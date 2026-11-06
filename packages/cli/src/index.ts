#!/usr/bin/env node
import { lockSkills, scanSkills, verifySkills, type LockDiff } from "@skill-lock/core";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { detectSkillsDir, runInit, SKILL_DIRS } from "./init.js";
import { VERSION } from "./version.js";

const USAGE = `skill-lock ${VERSION}: a lockfile for agent skills

Usage:
  skill-lock init   [--dir <folder>] [--no-ci]   set up: write skills.lock.json and a CI workflow
  skill-lock lock   [folder] [--update]          hash every skill into skills.lock.json
  skill-lock verify [folder]                     exit 1 if a skill was added, removed or changed
  skill-lock scan   [folder]                     exit 1 on remote code, secrets, suspicious hosts or hidden Unicode

folder        defaults to the first of ${SKILL_DIRS.join(", ")} that holds a skill
--lockfile    lockfile path (default skills.lock.json)
--no-ci       init only: do not write .github/workflows/skill-lock.yml

Start here: npx skill-lock init`;

function printDiff(d: LockDiff): void {
  for (const n of d.changed) console.log(`  changed  ${n}`);
  for (const n of d.added) console.log(`  added    ${n}`);
  for (const n of d.removed) console.log(`  removed  ${n}`);
}

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      update: { type: "boolean" },
      lockfile: { type: "string" },
      dir: { type: "string" },
      "no-ci": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  const [command, positionalDir] = positionals;
  if (values.version) {
    console.log(VERSION);
    return 0;
  }
  if (values.help || !command) {
    console.log(USAGE);
    return 0;
  }
  if (!["init", "lock", "verify", "scan"].includes(command)) {
    console.error(`Unknown command: ${command}\n\n${USAGE}`);
    return 1;
  }
  const dir = values.dir ?? positionalDir;

  if (command === "init") {
    return runInit({ cwd: process.cwd(), dir, ci: !values["no-ci"], version: VERSION });
  }

  const root = resolve(dir ?? detectSkillsDir(process.cwd())?.dir ?? SKILL_DIRS[0]);
  if (!existsSync(root)) {
    console.error(`No such folder: ${root}\nPass the folder that holds your skills, or run "npx skill-lock init".`);
    return 1;
  }
  const lockPath = resolve(values.lockfile ?? "skills.lock.json");
  const shown = relative(process.cwd(), lockPath) || lockPath;

  if (command === "scan") {
    const findings = scanSkills(root);
    for (const f of findings) console.log(`${f.skill}/${f.file}:${f.line}:${f.column}  ${f.rule}  ${f.detail}`);
    console.log(findings.length ? `${findings.length} finding(s).` : "No findings.");
    return findings.length ? 1 : 0;
  }

  if (command === "lock") {
    const { written, diff } = lockSkills(root, lockPath, { update: values.update });
    if (!written) {
      console.log(`Skills changed since ${shown} was written:`);
      printDiff(diff);
      console.log("Review the changes, then run again with --update to accept them.");
      return 1;
    }
    printDiff(diff);
    console.log(`Locked ${diff.unchanged.length + diff.added.length + diff.changed.length} skill(s) in ${shown}`);
    return 0;
  }

  const result = verifySkills(root, lockPath);
  if (result.error) {
    console.error(result.error);
    return 1;
  }
  if (!result.ok) {
    console.log("Skills do not match the lockfile:");
    printDiff(result.diff!);
    console.log('If the change is intended, run "skill-lock lock --update" and commit skills.lock.json.');
    return 1;
  }
  console.log(`OK: ${result.diff!.unchanged.length} skill(s) match ${shown}`);
  return 0;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
