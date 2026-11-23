---
name: agent-office-provider-status-recovery
description: Use when Agent Office falsely shows a provider as blocked.
category: debugging
---

Only a real usage-limit response may mark a provider as blocked. Transient failures (HTTP 529 overloaded, network drops, any error text that merely contains the word "rate") must never set a block.

- A stored block must heal itself: a forced fetch (`/api/providers?force=1`) returns fresh remaining percent, and the block clears when fresh data shows remaining capacity. Verify this with a forced fetch before calling the fix done.
- Persisted state lives in `~/Library/Application Support/Agent Office/provider-state.json` (keys `claude.blockedUntil`, `codex`). Reinstalling clears a stale block, but the fix is the detection logic, not the reinstall.
- The ⟳ button on a service card re-fetches limits and login state and spins while loading; test it in the browser, not only by reading the handler.
