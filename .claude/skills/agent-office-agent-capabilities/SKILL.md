---
name: agent-office-agent-capabilities
description: Use when editing agent permissions, Mac tools or skills.
category: agent-office
---

# Agent Office: agent capabilities

Make agents as capable as Claude itself: widen the toolbox by default and gate only what is genuinely risky.

- Permissions: everyday actions run without asking. Sensitive ones (seeing the screen, controlling input, controlling other apps, installing programs, files outside the project, unknown programs) ask once with Allow once, Always allow or Deny. Passwords and keychain, sudo, wiping disks, macOS security changes and git push are never allowed, whatever the answer. Change the policy in permissions.mjs and add or adjust the matching case in tests/permissions.test.mjs in the same change.
- Instructions live in roles/_contract.md (every agent) and boss.md (the boss). Add a new capability there as one short bullet naming the tools, and tell agents to verify their own work with it (open the built thing, take a screenshot, click through) instead of trusting code reading alone.
- Skills: tell agents to load and use an available skill whenever it fits, and to lean toward using more rather than fewer. Agents may install skills and plugins themselves. Codex reads the Claude skills folder, so one skill set serves both.
- Mac control (screen, input, other apps) goes through the Mac tools MCP server; each sensitive call asks the app's permission dialog. macOS privacy grants are tied to the app's code signature, so the build must sign with a stable designated requirement (identifier-based), or every reinstall silently revokes Screen Recording and Accessibility. After any change to signing, reinstall, then confirm the grants still read as enabled before testing agent Mac actions.
- A fast or direct mode is still a full agent session: give it the same toolbox (terminal, web, Mac tools, skills) and the same instructions as any other agent. Speed comes from skipping extra passes (research, plan, separate review), not from removing tools, pinning a weak model, or lowering effort by default. Describe it as a session with a realistic time range, never as a one-minute answer.
- Mac permission rows must show a live probe result, never a generic Allow button. Automation is checked with AEDeterminePermissionToAutomateTarget (noErr means allowed, askUserIfNeeded false) against Finder and System Events. Full Disk Access is probed by opening the user TCC database read-only. macOS never lists an app under Full Disk Access by itself, so that row must say to click + and pick the app, and reveal the bundle in Finder. Never run tccutil or edit privacy databases; the user clears stale records.
- Any new capability is described in both READMEs (English and Czech) in the same change.
