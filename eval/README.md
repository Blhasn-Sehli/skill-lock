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

The current labels are **pre-labels**: produced by that rule from a scan of each skill's scripts, then to be checked by hand. So far: 23 benign, 11 risky, 0 malicious.

## First scanner result

`skill-lock scan` on all 34: **1 finding, and it is a false alarm**. A line in `claude-api` warns the reader *not* to run `curl ... | sh`, and the remote-code rule flagged the quoted command. That is 1 of 34 skills with a false alarm (2.9%).

Recall cannot be measured yet: both sources are reputable, so there is nothing malicious to catch.

## Next

- Review the 34 pre-labels by hand.
- Add skills from community registries, where risky and malicious skills have been reported, collected carefully as data only.
- Add hostile sample skills written for this set (one per scanner rule and some the rules should miss), so recall has something to measure.
- Then report precision and recall for a naive keyword scanner and for `skill-lock scan`.
