#!/usr/bin/env node
import { lockSkills, scanSkills, verifySkills, type LockDiff } from "@skill-lock/core";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const USAGE = `skill-lock 0.0.0 (lite)

Usage:
  skill-lock lock [skills-dir] [--update] [--lockfile <path>]
  skill-lock verify [skills-dir] [--lockfile <path>]
  skill-lock scan [skills-dir]

skills-dir   folder holding skills (any folder with a SKILL.md); default .claude/skills
--lockfile   default skills.lock.json in the current folder
--update     accept added, removed or changed skills into an existing lockfile

verify exits with code 1 when a skill was added, removed or changed, so CI fails.
scan exits with code 1 when it finds something (remote code, secrets, suspicious hosts, hidden Unicode).`;

function printDiff(d: LockDiff): void {
  for (const n of d.changed) console.log(`  changed  ${n}`);
  for (const n of d.added) console.log(`  added    ${n}`);
  for (const n of d.removed) console.log(`  removed  ${n}`);
}

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { update: { type: "boolean" }, lockfile: { type: "string" }, help: { type: "boolean", short: "h" } },
  });
  const [command, dir = ".claude/skills"] = positionals;
  if (values.help || !["lock", "verify", "scan"].includes(command)) {
    console.log(USAGE);
    return values.help ? 0 : 1;
  }
  const root = resolve(dir);
  if (!existsSync(root)) {
    console.error(`no such folder: ${root}`);
    return 1;
  }
  const lockPath = resolve(values.lockfile ?? "skills.lock.json");

  if (command === "scan") {
    const findings = scanSkills(root);
    for (const f of findings) console.log(`${f.skill}/${f.file}:${f.line}:${f.column}  ${f.rule}  ${f.detail}`);
    console.log(findings.length ? `${findings.length} finding(s).` : "No findings.");
    return findings.length ? 1 : 0;
  }

  if (command === "lock") {
    const { written, diff } = lockSkills(root, lockPath, { update: values.update });
    if (!written) {
      console.log(`Skills changed since ${lockPath} was written:`);
      printDiff(diff);
      console.log("Review the changes, then run again with --update to accept them.");
      return 1;
    }
    printDiff(diff);
    console.log(`Locked ${diff.unchanged.length + diff.added.length + diff.changed.length} skill(s) in ${lockPath}`);
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
    return 1;
  }
  console.log(`OK: ${result.diff!.unchanged.length} skill(s) match ${lockPath}`);
  return 0;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
