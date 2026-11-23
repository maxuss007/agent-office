---
name: agent-office-ui-verification
description: Use when browser-checking an Agent Office UI change.
category: testing
---

Verify every Agent Office UI change in a browser against a throwaway dev server, and say exactly what was and was not checked.

1. Start a separate server on a spare port with a scratch data directory and a dev token: `PORT=4796 AGENT_OFFICE_HOME=<scratch dir> AGENT_OFFICE_TOKEN=dev node server.mjs`. Open it with `?t=dev&demo=1`. Stop it and delete the scratch directory afterwards.
2. Wait about 300 ms after a theme switch or hover before reading computed colours. A grey header mid-transition is not a bug.
3. Assert hover results from computed transform, box-shadow and background, not from a screenshot.
4. Drive each dialog's open and close paths from JavaScript and assert state (hidden flags, `dialog.open`).
5. Check desktop and phone widths. Open panels can cover the whole scene at narrow widths, so repeat the check on a wide window.
6. Run the test suite (`node --test tests/`) before reinstalling.
7. After rebuilding the installed app, report only what was checked: dev-server browser tests are not the same as clicks in the installed app.
