---
name: agent-office-ui-redesign
description: Use when redesigning Agent Office UI views or UX.
category: ui-design
---

# Agent Office: UI redesign rules

Simplify before restyling. Show less at once, give each view a clear hierarchy, and leave one obvious next action per view.

- Keep every existing function; change how it is reached and shown, not what it does.
- Redesign the whole surface together: hallway/repo list, project workspace, office scene, agent panels, dialogs, outputs. Do not leave old-style screens next to new ones.
- The office visual must match the new concept; do not keep the previous scene style.
- Verify light and dark mode, dialogs, and phone width (no horizontal overflow) before finishing.
- Rebuild and reinstall via agent-office-reinstall, then send screenshots of the installed app.
- When another session owns the backend in the same folder, stay in UI files only.
- Team members live in the office panel, not in a separate left column. The panel header has a segmented switch "Kancelář | Tým N" (N = member count) that flips between the office scene and the team view, and the choice is remembered. The team view is a wrapping grid of member blocks (portrait, name, role, status, model) in several rows, not a plain list. When there are many members it scrolls inside the panel, at the same height as the scene, so the page itself does not grow. The "+N" control on the scene opens the team view.
- After a Bash `sed` or python edit to a file you already read, Read that file again before the next Edit; the edit tool rejects stale reads.
- Every user-visible string goes into `public/i18n.js` in both English and Czech. English is the default. The language is chosen only on the first-launch setup screen (EN | CS buttons stored in `config.json`), not in the main header, so do not add a language switch to the header; later changes go through View → Set Up Tools. Do not hardcode Czech text in a view. The boss's replies follow the same language setting.
- When a behavior or screen changes, update `README.md` and `README.cs.md` in the same change so both still describe the same thing.
- Verify UI on a throwaway server: choose a free port, set `AGENT_OFFICE_HOME` to a scratch folder and `AGENT_OFFICE_TOKEN=dev`, then open `/?t=dev&demo=1&view=office&n=6`. Click CS and check `AO_I18N.lang` and `document.documentElement.lang`. Afterwards stop that server by its port, delete the scratch home, and reset the browser viewport with preset `desktop`.
