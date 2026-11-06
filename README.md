# skill-lock

**A lockfile for agent skills: pin every `SKILL.md` folder by content hash, fail CI when one changes, and scan skills for risky content.**

[![CI](https://github.com/Blhasn-Sehli/skill-lock/actions/workflows/ci.yml/badge.svg)](https://github.com/Blhasn-Sehli/skill-lock/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@mpkk/skill-lock)](https://www.npmjs.com/package/@mpkk/skill-lock)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Blhasn-Sehli/skill-lock/blob/main/LICENSE)

Agent skills are folders of instructions and scripts that an agent loads and follows. A one-line edit to a skill changes what your agent does, and it is easy to miss in review. skill-lock records a hash of every skill in `skills.lock.json`, so any change to a skill has to come with a visible lockfile change in the same pull request.

## Quick start

In the root of your repository:

```bash
npx @mpkk/skill-lock init
```

`init` finds your skills folder, writes `skills.lock.json` and adds a GitHub workflow that checks every pull request. Then commit both files:

```bash
git add skills.lock.json .github/workflows/skill-lock.yml && git commit -m "Lock agent skills"
```

That is the whole setup. From now on, a pull request that adds, removes or edits a skill fails until the lockfile is updated with `npx @mpkk/skill-lock lock --update`. Needs Node.js 22 or newer.

## What the scanner catches

`skill-lock scan` reads every text file of every skill and reports each finding with file, line and column. Four rules:

| Rule | Flags | Does not flag |
| --- | --- | --- |
| **Remote code** | Install steps that run code fetched at run time (`curl ... \| sh`, `bash -c "$(curl ...)"`, `iwr ... \| iex`, a download then `chmod +x`), and package installs moved to another registry (`npm config set registry`, `--index-url`, git `insteadOf`). | Plain API calls such as `curl https://api...` or `curl ... \| jq`. |
| **Secrets** | Credentials in a well-known format: AWS, GitHub, Slack, Stripe live, Google, OpenAI and Anthropic keys, private key blocks. Output names the kind of secret, never its value. | Documentation placeholders such as `AKIAIOSFODNN7EXAMPLE`. |
| **Suspicious hosts** | Raw public IP addresses, link shorteners, tunnels (ngrok, trycloudflare), paste sites, and services that collect posted data (webhook.site, Discord webhooks, transfer.sh). | Private and local addresses, ordinary domains. |
| **Hidden Unicode** | Zero-width characters, bidi controls and tag characters that can hide instructions from a human reviewer. | A zero width joiner inside emoji, a zero width non-joiner between Arabic-script letters, a byte order mark at the start of a file. |

## Commands

| Command | What it does | Exit code |
| --- | --- | --- |
| `skill-lock init [--dir <folder>] [--no-ci]` | Finds the skills folder, writes `skills.lock.json` and `.github/workflows/skill-lock.yml`. Safe to run again: existing files are kept, and a lockfile that no longer matches is reported, never overwritten. | 1 if the existing lockfile no longer matches |
| `skill-lock lock [folder] [--update]` | Hashes every skill into the lockfile. If skills changed since it was written, lists the changes and writes nothing until you pass `--update`. | 1 if changes were not accepted |
| `skill-lock verify [folder]` | Compares the skills on disk with the lockfile. | 1 if a skill was added, removed or changed |
| `skill-lock scan [folder]` | Runs the four rules above. | 1 if anything was found |

A skill is any folder that holds a `SKILL.md`. Without a folder argument, skill-lock uses the first of `.claude/skills`, `.agents/skills` and `skills` that holds a skill. `--lockfile <path>` changes the lockfile location (default `skills.lock.json` in the current folder). `skill-lock --help` shows a short summary.

## In CI

### The workflow written by `init` (recommended)

```yaml
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
      SKILLS_DIR: ".claude/skills"
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - name: Verify skills match skills.lock.json
        run: npx --yes @mpkk/skill-lock@0.1.0 verify "$SKILLS_DIR"
      - name: Scan skills
        if: success() || failure()
        run: npx --yes @mpkk/skill-lock@0.1.0 scan "$SKILLS_DIR"
```

It calls the npm package directly, pinned to the exact version that wrote it. That is the more robust choice: a published npm version cannot be replaced, so the check that guards your skills cannot change under you; there is no extra layer (a Git tag to resolve, an action to download); and it needs only Node.js, so the same two commands work on any CI system. To upgrade, change the version in the file. The scan step runs even when verify fails, so one run shows both results.

### The GitHub Action

If you prefer `uses:`, the same checks are available as a composite action:

```yaml
- uses: actions/checkout@v7
- uses: Blhasn-Sehli/skill-lock@v0
  with:
    dir: .claude/skills   # optional; empty means auto-detect
    scan: true            # optional; false runs verify only
```

The action runs the npm release it pins (`@mpkk/skill-lock@0.1.0` in this version), so both routes run identical code. For the strongest guarantee, pin the action to a commit SHA rather than a tag.

## How hashing works

Each skill's hash is sha256 over every file in its folder, sorted by path. For each file it hashes the path relative to the skill (with forward slashes), then the content. To keep hashes stable across machines:

- **Line endings:** text files are hashed with LF line endings, so a Windows (CRLF) checkout and a Linux checkout give the same hash. A file containing a NUL byte is treated as binary and hashed byte for byte.
- **Symlinks** are hashed as their target path and never followed, so a skill cannot pull in files from outside its folder.
- **Every file counts,** including scripts, assets and dotfiles inside the skill.

## Lockfile format

```json
{
  "$schema": "https://raw.githubusercontent.com/Blhasn-Sehli/skill-lock/main/schema/skills.lock.schema.json",
  "version": 1,
  "skills": {
    "demo": "sha256-3f9a...",
    "team/review": "sha256-b41c..."
  }
}
```

Keys are skill folders relative to the skills folder, with forward slashes; values are `sha256-` plus 64 hex characters. The format is described by a JSON Schema in [`schema/skills.lock.schema.json`](https://github.com/Blhasn-Sehli/skill-lock/blob/main/schema/skills.lock.schema.json), so other tools can read and validate it.

## How well the scanner works

Measured, not claimed. The [evaluation set](https://github.com/Blhasn-Sehli/skill-lock/blob/main/eval/README.md) has 34 public skills (from `anthropics/skills` and `obra/superpowers`, pinned to commits and labelled by hand) and 8 small hostile skills written for the set. First result (Nov 5, 2026):

- **Recall:** 5 of 8 hostile skills flagged (62.5%). The three misses (a base64-encoded command, a download run on a later line, a plain-English request to paste an SSH key) were built to show the rules' limits.
- **Precision:** 6 skills flagged, 5 of them hostile (83%). The false alarm is a line in a public skill that warns the reader *not* to run `curl ... | sh`.

This is a small set, mostly reputable skills, and the hostile samples were written by the same person who wrote the rules. Read the numbers as direction, not real-world accuracy.

## Limits and status

skill-lock is early (0.1). Be clear about what it does and does not do:

- **The lockfile proves change, not safety.** `verify` tells you a skill changed; a person still has to read the change. Locking a malicious skill makes it pass.
- **The scanner is pattern-based.** It reads text with rules and does not run anything. Encoded or split commands and plain-language instructions get past it, as the misses above show. A clean scan is not a security review.
- **Not built yet:** per-skill allowed hosts (a manifest), a larger evaluation set with real-world malicious skills, and a runtime guard.

## Contributing and security

See [CONTRIBUTING.md](https://github.com/Blhasn-Sehli/skill-lock/blob/main/CONTRIBUTING.md). To report a vulnerability privately, see [SECURITY.md](https://github.com/Blhasn-Sehli/skill-lock/blob/main/SECURITY.md).

## License

[MIT](https://github.com/Blhasn-Sehli/skill-lock/blob/main/LICENSE)
