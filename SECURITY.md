# Security

## Reporting a problem

Please do not open a public issue for a security problem. Use **Security → Report a vulnerability** on this repository's GitHub page, which sends a private report. You should get a first reply within a week.

A way to change a skill without `skill-lock verify` noticing (two different skill folders with the same hash, a file the hash skips, a path trick) is a security bug. So is any way to make skill-lock run, follow or write outside the skills folder.

Content the scanner misses is usually a rule limit, not a vulnerability: open a normal issue with a harmless sample, or a pull request adding it to `eval/hostile/`.

## What skill-lock does to stay safe

skill-lock reads skills that may be hostile. These are the rules it follows; a way around any of them is a security bug.

- **Skills are data.** Files are read and hashed, never run, imported or evaluated.
- **Symlinks are never followed.** A symlink is hashed as its target path and skipped by the scanner, so a skill cannot pull in files from outside its folder.
- **No silent acceptance.** `lock` does not overwrite a lockfile whose skills changed unless you pass `--update`, and `init` never overwrites an existing lockfile or workflow.
- **Secrets are not echoed.** A scan finding for a credential names its kind, never its value, so CI logs do not leak it.
- **No paths in shell commands.** The workflow written by `init` and the GitHub Action pass the skills folder through an environment variable, never by pasting it into a command, and the workflow only gets `contents: read`.
- **No network, no runtime dependencies.** The CLI makes no network calls and ships as one bundled file that uses only Node.js built-ins.
- **Pinned in CI.** The generated workflow and the action run an exact npm version, not a range.

## Supported versions

Only the latest release is supported while the project is pre-1.0.
