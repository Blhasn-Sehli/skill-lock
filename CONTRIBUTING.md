# Contributing

Thanks for helping. Small, focused pull requests are the easiest to review and merge.

## Setup

You need Node.js 22 or newer and pnpm.

```bash
pnpm install
pnpm build
pnpm test
```

Tests run offline and need nothing else installed. To try your build: `node packages/cli/dist/skill-lock.js --help`.

## Layout

- `packages/core`: hashing, the lockfile, and the scanner rules (`scan.ts`). Internal, not published on its own.
- `packages/cli`: the `skill-lock` command, including `init`. `bundle.mjs` builds the single file published to npm as `skill-lock`.
- `action.yml`: the GitHub Action. It runs the npm release pinned in its `SKILL_LOCK_VERSION`, which a test keeps equal to the CLI's version.
- `schema/`: the JSON Schema of `skills.lock.json`.
- `eval/`: the labelled evaluation set behind every published precision and recall number.

## Before you open a pull request

- Open an issue first for anything bigger than a small fix, so we can agree on the approach.
- Add or update tests for any change in behaviour; write the failing test first when you fix a bug.
- Run `pnpm build && pnpm typecheck && pnpm test`; CI runs the same.
- Changing the hash changes every user's lockfile. Do it only with a new lockfile `version` and a migration path.
- If you change a scanner rule, rerun it on the evaluation set (see [eval/README.md](eval/README.md)) and include the before and after numbers.
- Never put a number in a README or post that was not measured, and say how it was measured.

## AI-assisted contributions

Welcome, on one condition: you understand every line you submit and have run it.

## Conduct

Be kind, be specific, assume good faith.
