---
name: agent-office-provider-status-recovery
description: Use when Agent Office falsely shows a provider as blocked.
category: debugging
---

Only a real usage-limit response may mark a provider as blocked. A single model refusing for access reasons (for example "requires usage credits") blocks only that model alias; the provider stays usable and the fallback rule in agent-office-model-catalog applies. Transient failures (HTTP 529 overloaded, network drops, any error text that merely contains the word "rate") must never set a block.

- A stored block must heal itself: a forced fetch (`/api/providers?force=1`) returns fresh remaining percent, and the block clears when fresh data shows remaining capacity. Verify this with a forced fetch before calling the fix done.
- Persisted state lives in `~/Library/Application Support/Agent Office/provider-state.json` (keys `claude.blockedUntil`, `codex`). Reinstalling clears a stale block, but the fix is the detection logic, not the reinstall. To test a healing fix, seed the dev server's scratch provider-state.json with a future blockedUntil, load the page, and confirm the card shows the fresh remaining percent without reinstalling.
- The ⟳ button on a service card re-fetches limits and login state and spins while loading; test it in the browser, not only by reading the handler.
- Before debugging a repeated error, compare its timestamp with the installed build. Error lines in `feeds.json`, `state.json` or the boss feed written before the fix are history. The newest `attempts.jsonl` line (outcome, model used) shows the live state. Report that instead of the old line, and say which build the check ran against.
