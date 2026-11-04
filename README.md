# skill-lock

Pin agent skills by content hash and fail CI when one changes (a lockfile for SKILL.md folders).

## Status

Lite, early. What works today:

- `skill-lock lock [skills-dir]` finds every folder with a `SKILL.md` (default `.claude/skills`), hashes each one, and writes `skills.lock.json`. If skills changed since the lockfile was written, it lists the changes and writes nothing until you pass `--update`.
- `skill-lock verify [skills-dir]` exits with code 1 when a skill was added, removed or changed, so a CI step fails.
- `skill-lock scan [skills-dir]` reports invisible characters that can hide instructions from a human reviewer: zero-width characters, bidi controls and tag characters, with file, line and column. To keep noise low it allows a zero width joiner between emoji, a zero width non-joiner between Arabic-script letters (Persian uses it), and a byte order mark at the start of a file. Exits with code 1 when it finds something.

How a skill is hashed: sha256 over every file's path and content, sorted. Text files are hashed with LF line endings, so Windows and Linux checkouts match. Symlinks are hashed as their target path and never followed.

The lockfile format is described by a JSON Schema in [`schema/skills.lock.schema.json`](schema/skills.lock.schema.json), so other tools can read and check it; lockfiles link to it through `$schema`.

Not built yet: more scanner rules (install steps that fetch binaries, hardcoded credentials, unexpected network hosts), a labelled evaluation set with precision and recall, and the runtime guard.

## Try it

```bash
pnpm install && pnpm build
node packages/cli/dist/index.js lock .claude/skills
node packages/cli/dist/index.js verify .claude/skills
```

## License

MIT
