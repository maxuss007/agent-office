---
name: agent-office-usage-limits
description: Use when Agent Office hits a usage limit or reset time.
category: integration
---

# Agent Office usage limits

A usage limit parks work; it never fails it or spends budget on it.

- A refused call does not count toward `stats.runs`. The project moves to status `limit` with `limit.until` read from the provider message, resumes by itself at that time, and also after an app restart.
- Relative resets ("in 2 hours 13 minutes", "in 45 minutes") are parsed with a leading `\bin\s+` anchor, so a bare "in" elsewhere in the text cannot match. Absolute resets ("resets 2:10am") go through the usage-screen parser.
- Claude's `/usage` screen shows stale cached numbers before fresh ones. Wait until the numbers settle before trusting a percentage.
- Cover each reset format and a no-match string in a test. The fake-CLI fixture pattern is in `references/limit-test-fixture.md`.
