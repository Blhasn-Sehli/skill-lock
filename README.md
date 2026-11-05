# skill-lock

Pin agent skills by content hash and fail CI when one changes (a lockfile for SKILL.md folders).

## Status

Lite, early. What works today:

- `skill-lock lock [skills-dir]` finds every folder with a `SKILL.md` (default `.claude/skills`), hashes each one, and writes `skills.lock.json`. If skills changed since the lockfile was written, it lists the changes and writes nothing until you pass `--update`.
- `skill-lock verify [skills-dir]` exits with code 1 when a skill was added, removed or changed, so a CI step fails.
- `skill-lock scan [skills-dir]` checks every text file of every skill and exits with code 1 when it finds something. Findings are sorted by file and line. Four rules so far:
  - **Remote code:** install steps that run code fetched at run time (`curl ... | sh`, `bash -c "$(curl ...)"`, `bash <(curl ...)`, `iwr ... | iex`, a download followed by `chmod +x` or `./tool`) or that move package installs to another registry (`npm config set registry`, `--registry` / `--index-url` pointing anywhere but the official npm and PyPI registries, git `insteadOf`, `/etc/apt/sources.list`). Plain API calls such as `curl https://api...` or `curl ... | jq` are not flagged.
  - **Secrets:** credentials in a well-known format (AWS, GitHub, Slack, Stripe live, Google, OpenAI and Anthropic keys, private key blocks). Documentation placeholders such as `AKIAIOSFODNN7EXAMPLE` or `ghp_xxxx...` are skipped, and the output names the kind of secret, never its value, so CI logs do not leak it.
  - **Suspicious hosts:** URLs a skill should rarely need: raw public IP addresses, link shorteners, tunnels (ngrok, trycloudflare), paste sites, and services that catch posted data (webhook.site, Discord webhooks, transfer.sh). Private and local addresses and ordinary domains are not flagged.
  - **Hidden Unicode:** invisible characters that can hide instructions from a human reviewer: zero-width characters, bidi controls and tag characters, with file, line and column. To keep noise low it allows a zero width joiner between emoji, a zero width non-joiner between Arabic-script letters (Persian uses it), and a byte order mark at the start of a file.

How a skill is hashed: sha256 over every file's path and content, sorted. Text files are hashed with LF line endings, so Windows and Linux checkouts match. Symlinks are hashed as their target path and never followed.

The lockfile format is described by a JSON Schema in [`schema/skills.lock.schema.json`](schema/skills.lock.schema.json), so other tools can read and check it; lockfiles link to it through `$schema`.

Not built yet: per-skill allowed hosts (a manifest), a labelled evaluation set with precision and recall, and the runtime guard.

## Try it

```bash
pnpm install && pnpm build
node packages/cli/dist/index.js lock .claude/skills
node packages/cli/dist/index.js verify .claude/skills
```

## License

MIT
