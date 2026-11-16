---
name: agent-office-model-catalog
description: Use when Agent Office model list, effort options, or a provider CLI (Claude, Codex, Antigravity agy, Gemini) is added, removed, or swapped.
category: integration
---

# Agent Office model catalog

Discover models and features from the installed CLIs at runtime. Do not hardcode model lists.

- Claude: parse the `--model <model>` alias list from `claude --help`, always add `opus`, `sonnet`, `haiku`. Cache the result keyed by binary path plus mtime. Ultrareview is available only if `--help` mentions it.
- Codex: models and efforts come from its app-server.
- Tiers are a map: fable is frontier, opus deep, sonnet balanced, haiku fast. An unknown alias defaults to deep. Frontier is kept for the boss and for judgement, not routine work.
- Efforts: Codex accepts `ultra`; Claude maps `ultra` to `max`. The effort list is shared in `orchestrator.mjs`.
- Feature state (fast mode) is read from the run result (`fast_mode_state`) and stored with `recordFeature`. The user preference is `auto`, `off` or `always`.
- When a value becomes valid, update the test that asserted it was invalid. Do not change the code back. Example: the `ultra` effort test.
- Optional Google providers join automatic routing once signed in (no `manual` flag): Gemini gets a bonus for research/study tasks, Antigravity for coding; elsewhere they rank slightly below Claude and Codex. A pinned `gemini/...` or `antigravity/...` model still forces them. Neither is ever the boss.
- Headless runner: call `agy` with a JSON schema, read `structured_output` from the result, pass `accept-edits` for file edits, and never `--dangerously-skip-permissions`.
- Test a CLI runner with a fake binary named by an env var (`AGY_BIN`) that prints the JSON you expect. Cover success, an `ERROR` status, and the argument list.
- After editing the connection/settings page script, run `node --check` on the extracted script. One missing comma in the provider object made `openProviders` undefined and silently broke the whole page; read the browser console before anything else.
- Antigravity is shown as a sub-section under the Gemini card in the connection window, not as its own card. Keep the two in sync when either changes.
