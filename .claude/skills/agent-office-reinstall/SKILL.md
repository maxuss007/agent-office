---
name: agent-office-reinstall
description: Use when rebuilding or reinstalling the Agent Office app.
category: deployment
---

# Agent Office reinstall and test

Do not reinstall the app while a user project may be running. Ask the user first, or stop the project before rebuilding.

Do not build or install while another session is editing the app's UI files (for example `public/`). A build packages their half-finished work into the installed app. Send that session the build request via cross-session message and leave the build to it; say in the report that nothing was installed.

Procedure:
1. Check active projects through `/api/state` on port 4747, using the token from `defaults read com.agentoffice.app token`. An empty ACTIVE list is not proof of safety: a reinstall still interrupted a running project, and auto-resume restarted it later.
2. Free the dev port before tests: `lsof -ti tcp:4796 | xargs kill`.
3. Run `node --test tests/*.test.mjs` from the repo root and expect `fail 0`.
4. Build and install from the repo root with `bash mac/build.sh`, not `cd mac && ./build.sh`. A good run ends with `Installed: /Applications/Agent Office.app`.
5. Find the port from the listening socket (`lsof -nP -iTCP -sTCP:LISTEN`, node on 127.0.0.1:47xx), then poll until the server answers instead of sleeping a fixed time. Probe `/`, `/i18n.js`, `/office-suits.js`, `/assets/suits/office.png` and `/api/state?t=<token>`. All must return 200, and `/api/state` reports `lang` (en by default).
6. Open a project in the installed app and confirm members render, the office view is visible, and the project workspace is not blank after entering (a stuck entrance animation once left it empty). Verify the installed build, not only the dev server.

Before the reinstall, read each `state.json` under `~/Library/Application Support/Agent Office/projects/*/` and stop if any status is `running`, `waiting_user` or `limit`. Build from the repo root with `bash mac/build.sh`; a successful run ends with `Installed: /Applications/Agent Office.app`. The build targets macOS 13.0 as a universal binary, not just the host OS, so after install confirm `lipo -archs` lists x86_64 and arm64, `vtool -show-build` on the binary shows `minos 13.0`, and `PlistBuddy -c "Print :LSMinimumSystemVersion"` prints 13.0. Stop a dev server only by matching its PORT in the process environment, not by killing every `node server.mjs`.

Pitfalls:
- A bulk rename on 11-11 corrupted the character asset file, so the office loaded without characters. After any bulk rename or move, check the members render.
- Tests passing does not prove the installed app works.
- To verify a flow that calls a paid model (a boss or agent run), do not start a real run on the user's usage limits. Verify in a scratch project with the model call replaced by a canned response, and say in the report that the real model run was not exercised.
- Never run the test suite in parallel with a build, install, or dev server on the same machine. A test failed once during a concurrent build (pass 42, fail 1), and three sequential runs with nothing else running all passed (43/43 each time). Rerun the suite alone to confirm a failure before treating it as real, and report the rerun result.
- The build uses `mac/AppIcon.png` when it exists (sized with `sips`, packed with `iconutil`) and falls back to `make-icon.swift` otherwise. After an icon change, quit and relaunch the installed app before judging it, since the Dock can keep the old icon.
- A user-supplied icon PNG with transparent edges and its own rounded corners gets a grey frame from new macOS. Re-render it on the macOS template: a rounded square on a 1024 px canvas with margin and shadow, the whole mascot visible. Confirm the Dock shows no frame, then restart the Dock.
- The DMG installer path (`bash mac/make-dmg.sh`) is covered in agent-office-dmg-installer. A reinstall of the app does not rebuild the DMG.
- The installed app is signed only locally (ad hoc). After a reinstall macOS may ask again for Screen Recording, Accessibility and Automation, so the permission guide shows them as not granted. Read `/api/permissions?t=<token>` (`system` and `policy.macGuideDone`) after install, and tell the user that they must click Allow again. Never report the Mac tools as working on a fresh install without that check.
- To see the first-launch setup screen in the installed app: back up the marker (`$HOME/Library/Application Support/Agent Office/.setup-done`), quit the app, build with `AO_SKIP_SETUP=1 bash mac/build.sh`, relaunch, screenshot the window by its id from `CGWindowListCopyWindowInfo`, then restore the marker. Never leave the marker removed.
