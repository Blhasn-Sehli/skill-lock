# Evaluation set (in progress)

Public agent skills, labelled by hand, to measure the scanner's precision and recall instead of claiming them. Target: 100 skills, including real risky and malicious ones.

## What is here now (Nov 5, 2026)

34 skills from two public sources, pinned to commits in [`skills.json`](skills.json). The skill files are not copied into this repo: `node eval/fetch.mjs` downloads them into `eval/skills/` (git-ignored). Nothing in this folder runs them.

| Source | Commit | Skills |
| --- | --- | --- |
| [anthropics/skills](https://github.com/anthropics/skills) | `ca45fc4` | 19 |
| [obra/superpowers](https://github.com/obra/superpowers) | `22f0b46` | 15 |

## Labels

[`labels.json`](labels.json) has one entry per skill: `benign`, `risky` or `malicious`, a one-line reason, the scanner's findings, and `reviewed` (false until a person has checked the label).

- **benign:** instructions only, or scripts that do not reach the network, start programs or delete files.
- **risky:** scripts that can reach the network, start programs or delete files. Usually legitimate (a document converter starts LibreOffice), but a reviewer should know before installing.
- **malicious:** written to harm the user, for example to steal credentials or run hidden code.

Labels were first produced by that rule, then reviewed on Nov 5 by reading what each risky skill's scripts connect to, start and delete (one rule-based label changed: `algorithmic-art` is benign; its only "exec" is a regular-expression call). Now: 24 benign, 10 risky, 0 malicious, all risky ones legitimate for what the skill does. A second reviewer (MpK) still spot-checks.

## First scanner result

`skill-lock scan` on all 34: **1 finding, and it is a false alarm**. A line in `claude-api` warns the reader *not* to run `curl ... | sh`, and the remote-code rule flagged the quoted command. That is 1 of 34 skills with a false alarm (2.9%).

Recall cannot be measured yet: both sources are reputable, so there is nothing malicious to catch.

## Hostile samples (written for this set)

[`hostile/`](hostile/) holds 8 small malicious skills written for this set. They are harmless by construction: every host is on a reserved domain (`.invalid`) or a test endpoint, and nothing runs them. Five match one scanner rule each; three are built to slip past the current rules, to show their limits honestly.

| Sample | What it does | Caught |
| --- | --- | --- |
| `pipe-installer` | `curl ... \| bash` install step | yes (pipe-to-shell) |
| `hidden-instruction` | instruction hidden behind zero-width and bidi characters | yes (hidden-unicode) |
| `leaked-token` | a GitHub token in the text | yes (secret) |
| `exfil-webhook` | posts `.env` to webhook.site | yes (suspicious-host) |
| `registry-swap` | `npm config set registry` to another host | yes (registry-override) |
| `encoded-command` | base64-encoded `curl \| sh` | **no** |
| `split-download` | download to a file, then run it on the next line | **no** |
| `prose-exfil` | asks the agent in plain English to paste `~/.ssh/id_rsa` | **no** |

## First numbers (Nov 5, 34 public + 8 hostile skills)

- **Recall:** 5 of 8 hostile skills flagged (62.5%). The three misses are the ones built to show the rules' limits.
- **Precision:** 6 skills flagged, 5 of them hostile (83%). The wrong one is the `claude-api` warning line above.
- These are first numbers on a small set, mostly reputable skills and samples written by the same person who wrote the rules. They show direction, not real-world accuracy.

## Next

- Review the 34 pre-labels by hand.
- Add skills from community registries, where risky and malicious skills have been reported, collected carefully as data only.
- Add hostile sample skills written for this set (one per scanner rule and some the rules should miss), so recall has something to measure.
- Then report precision and recall for a naive keyword scanner and for `skill-lock scan`.
