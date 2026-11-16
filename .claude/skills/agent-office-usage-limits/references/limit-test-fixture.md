# Limit test fixture (condensed)

Test file: `tests/limit.test.mjs`. It runs the orchestrator against a fake `CLAUDE_BIN` script.

- Set `AGENT_OFFICE_HOME`, `CLAUDE_CONFIG_DIR` and `CLAUDE_BIN` to a temp dir.
- The fake script answers `auth` with `loggedIn:true`. For `--json-schema` calls it dispatches on the schema's `required` keys (research, tasks, conclusion, criteria).
- While a `reset` marker file is absent, the intake call writes `limit` to `calls.txt` and returns `is_error:true` with "You've hit your 5-hour limit · resets in 30 minutes".
- Assertions: status becomes `limit`; `limit.until` is more than 25 minutes ahead; `stats.runs === 0`; the boss activity matches /Došel limit/. Then create the `reset` file and assert the project continues and finishes.
- Run with `node --test tests/limit.test.mjs`. Use a 60 s timeout.

Regex that parses relative resets in `claude-usage.mjs` (`resetTimeFromText`):

```js
const rel = t.match(/\bin\s+(\d+)\s*(h\b|hours?|hod\w*|m\b|mins?|minutes?|minut\w*)(?:\s*(?:and\s+|a\s+)?(\d+)\s*(?:m\b|mins?|minutes?|minut\w*))?/i);
```

Check: "2 hours 13 minutes" gives 133 min; "45 minutes" gives 45; "nothing here" gives null.
