// Download the evaluation skills at their pinned commits into eval/skills/<owner>__<repo>/ (git-ignored).
// Only the listed skill folders are checked out. Skill files are data: nothing here runs them.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sources = JSON.parse(readFileSync(join(here, "skills.json"), "utf8"));
const git = (cwd, ...args) => execFileSync("git", args, { cwd, stdio: "inherit" });

for (const { repo, commit, skills } of sources) {
  const dir = join(here, "skills", repo.replace("/", "__"));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    git(dir, "init", "-q");
    git(dir, "remote", "add", "origin", `https://github.com/${repo}.git`);
    git(dir, "config", "core.sparseCheckout", "true");
  }
  git(dir, "sparse-checkout", "set", "--no-cone", ...skills.map((s) => `/${s}/`));
  git(dir, "fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", commit);
  git(dir, "checkout", "-q", "FETCH_HEAD");
  console.log(`${repo} @ ${commit.slice(0, 7)}: ${skills.length} skills`);
}
