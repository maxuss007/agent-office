---
name: agent-office-run-resume
description: Use when an Agent Office run hits the usage limit.
category: agent-orchestration
---

# Agent Office: usage-limit and resume behavior

A run that hits the usage limit keeps its progress and continues by itself when the limit resets. A manual retry button is only a fallback, never the main path.

- Persist run state (brief, research, criteria, plan, finished tasks, last round result) before any step that can hit the limit, so a limit error or app restart loses nothing.
- Parse the reset time from the limit error (e.g. "resets 2:10am (Europe/Prague)") and schedule the resume for that moment.
- While blocked, the UI greys the screen out, says the limit was reached, shows the reset time when known, and offers "Zkusit znovu" as a secondary action.
- Until the backend exposes a limit state, build the UI against a clear state field and adapt when the API lands.
- Restarts and reinstalls also interrupt runs; auto-resume must cover them too (see agent-office-reinstall).
- Only a crash loop (3 restarts within 10 minutes) is slowed down. A deliberate reinstall or update restart resumes the run at once; a one-hour window once delayed a project by 10 minutes after the user's own reinstall.
- A network outage does not fail a step: wait for the connection to return, then retry that step. Only Pause and Stop end a run, and pausing also cancels any scheduled auto-resume.
