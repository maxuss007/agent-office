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
- Reset text from a provider can be malformed, for example a truncated timezone such as `Europm (Europe/Prague`. When the timezone name is unknown, fall back to the Mac's own time zone and still parse the reset time; the parser must never throw on it. This supersedes an earlier rule that treated the broken zone as no match, which left the project parked without a reset time. An exception there once took down the whole server, so the office images stopped loading. If the server still dies, the app restarts it and the crash stays in the log.
- Cover each reset format, a malformed timezone and a no-match string in a test. The fake-CLI fixture pattern is in `references/limit-test-fixture.md`.
