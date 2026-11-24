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
- When a model refuses with "requires usage credits" (or another no-access answer), block only that model alias for a fixed window (about six hours, stored as `claude/fable` with `until` in provider-state.json) and fall back at once to the next tier down (fable → opus → sonnet → haiku). Never halt the run. This applies to the boss and to a model pinned by hand. The owner asked for exactly this: when the best model is not available, pick the weaker one and keep working.
- Efforts: Codex accepts `ultra`; Claude maps `ultra` to `max`. The effort list is shared in `orchestrator.mjs`.
- The boss is forced to `high` effort: `desiredEffort` in `providers.mjs` ignores the requested effort for `role === 'boss'` unless `effortOverride` is set. A quick path that must stay low (ultra fast answers) passes `keepEffort: true` to `ask()`, which `orchestrator.mjs` turns into `effortOverride`. Check the result with `state.json` (`agents.boss.model` and `effort`), not with the UI.
- Do not use `keepEffort: true`, the fastest tier or no-terminal settings for a mode the user calls a full session (for example "Rovnou"). Those settings turn it into one quick reply. A speed-named mode such as "Ultra rychle" is the same case: the user rejected the one-reply version ("do minuty" did not fit) and asked for a normal Claude Code-style session, so a speed label does not license the fastest tier or no terminal. A mode the user describes as "like Claude Code" keeps normal effort, tools and the terminal. Check the mode's name and the user's wording before choosing effort.
- Feature state (fast mode) is read from the run result (`fast_mode_state`) and stored with `recordFeature`. The user preference is `auto`, `off` or `always`.
- When a value becomes valid, update the test that asserted it was invalid. Do not change the code back. Example: the `ultra` effort test.
- Optional Google providers join automatic routing once signed in (no `manual` flag): Gemini gets a bonus for research/study tasks, Antigravity for coding; elsewhere they rank slightly below Claude and Codex. A pinned `gemini/...` or `antigravity/...` model still forces them. Neither is ever the boss. The owner asked for these to be used by the boss on its own, so do not bring back a manual-only flag or a "never auto" note in the code, tests, README or connection guide; keep all four in step.
- Headless runner: call `agy` with a JSON schema, read `structured_output` from the result, pass `accept-edits` for file edits, and never `--dangerously-skip-permissions`.
- Test a CLI runner with a fake binary named by an env var (`AGY_BIN`) that prints the JSON you expect. Cover success, an `ERROR` status, and the argument list.
- After editing the connection/settings page script, run `node --check` on the extracted script. One missing comma in the provider object made `openProviders` undefined and silently broke the whole page; read the browser console before anything else.
- Antigravity is shown as a sub-section under the Gemini card in the connection window, not as its own card. Keep the two in sync when either changes.
