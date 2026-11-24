---
name: agent-office-app-update
description: Use when shipping or testing Agent Office in-app updates.
category: deployment
---

# Agent Office app update

Ship updates as a `version` bump in `version.json` pushed to `main`. The installed app downloads only the server and UI into `~/Library/Application Support/Agent Office/app/` and restarts itself. The native Swift shell is never replaced by an update.

- Raise `version` numerically (1.10.0 is newer than 1.9.0) and write a short `notes` line in the user's language. Set `repo` once; while it is empty the update check stays off.
- Raise `shell` only when `mac/AgentOffice.swift` changes, and bump `static let shellVersion` in that file to the same number. Files bundled in the Mac app (`mac/AgentOffice.swift`, `mac/setup.html`) count as shell changes: the app then offers a link to the new DMG instead of installing, so they always need a new DMG.
- The updater must refuse a tarball whose `server.mjs` does not parse. Keep that test and run `node --test tests/` before pushing.
- Test the whole path with a fake GitHub in the scratchpad: serve `version.json` and a codeload-shaped tarball (one top folder, app inside `agent-office/`) with `python3 -m http.server`, start the server with `AGENT_OFFICE_UPDATE_URL`, `AGENT_OFFICE_UPDATE_TARBALL` and an isolated `AGENT_OFFICE_HOME` on a spare port. `GET /api/update?force=1` must return `available: true` with the new version.
- Test install and fallback on the installed app: copy the bundled `Resources/server` into `app/` as a test version, bump its version, add a marker to `public/index.html`, write `current.json`, relaunch, and confirm the marker serves. Then break its `server.mjs`, relaunch, and confirm the app falls back to the bundled copy (check the process cwd with `lsof -p PID -d cwd`).
- A GitHub repo or release that was just created can keep answering 404 for a few minutes, so the update check fails with no real fault. Wait and re-query before debugging the app.
- When the user says to release a version (for example "vydej 1.5.2"), also cut the DMG release: bump `version.json` with English notes, run `bash mac/build.sh` and `bash mac/make-dmg.sh`, sync the public copy and run the share-copy check (see agent-office-share-copy), zip the source without `.git`, `mac/build`, `.agents` and `.DS_Store`, commit and push to `main`, then `gh release create vX.Y.Z` with the DMG attached as `Agent.Office.dmg`, `--target main --latest`.
- Before uploading, attach the built DMG read-only, check its bundle identifier and bundled `version.json`, and grep it for the owner's name and email. Detach it afterwards.
- After a release, the in-app check can keep showing the previous latest version for a few minutes. Re-query `/api/update?force=1` before calling the release broken.
- Remove every test artifact (test directory, bad `current.json`, empty `app/`) and stop the fake servers by port before reporting.
- Report only what was checked. The restart button inside the native shell stays unverified until it has run there.
