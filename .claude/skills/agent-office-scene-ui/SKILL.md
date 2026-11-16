---
name: agent-office-scene-ui
description: Use when editing Agent Office scene sprites or avatars.
category: ui-design
---

# Agent Office scene UI

Keep the office scene a flat, illustrated, single fixed frame. Do not reintroduce a 3D scene, camera orbit or pan; the user rejected the earlier 3D version as poor UX.

- The current scene is `public/office-suits.js`, loaded by `index.html`. Keep the same `window.OfficeGame` API. Any file under `public/` the page loads must be on the static allowlist in `server.mjs`; probe its URL and expect 200.
- Project layout: scene full width on top; below it, boss and tasks on the left and outputs on the right. Team is not a left column: it sits in the office panel behind the "Kancelář | Tým N" switch.
- Boss (Harvey) sits in his chair behind his desk, which hides him from the chest down. Donna sits at reception behind her monitor, head and shoulders above it, on the phone when idle and typing when working. The main five (harvey, donna, mike, rachel, louis) are never given to extra agents.
- Seats: align seated sprites to the chair backrest, not the desk. Harvey and Donna always sit in their chairs facing the viewer, whatever their status. Other working agents sit with their back to the viewer and the backrest in front of them. Idle, waiting or done agents stand beside their chair facing the viewer. Blocked agents walk the aisle behind Harvey with a "!" and alternating legs, then sit on one of the two benches in Harvey's office with their back to the viewer. Visitors beyond the two benches stand in the corridor by the door.
- When the user supplies a layout screenshot, zoom it to measure target positions, then align sprites to it. Zoom again after each offset change; the first pass is usually a few points off.
- Character pool: the face pool is what the art sheet contains. Count it before promising more. If agents outnumber characters, extras get a random but stable face from the supporting cast, and the overflow collapses behind "+N" that opens the team view. Report any shortfall instead of inventing characters.
- Avatars: every place a member appears (team blocks, detail panel) uses the same circular face crop, via a background-image sprite crop, not an `<img>` with offset math.
- Standing sprites must be refreshed after load: call `this.sprite(p, 'standing')` in the non-walking branch.
- Seated back views are a stopgap: they are recoloured standing sprites clipped at the backrest top (clipPath, only head and shoulders show). Say so in the report. Real seated and back art needs new generation from the brief in `art/ZADANI-PRO-CODEX.md`, which requires the user's own ChatGPT or Codex session. The brief ships with its reference images. Do not install paid image-generation skills (RunComfy and similar) without asking; they need the user's account.
- Seated figures in dark chairs need a brightness and saturation lift plus a faint light rim (about 0.4 opacity). A hard white outline reads as a sticker.
- Seated figures must match standing figures in scale. Before calling a seated sprite done, compare it with a standing one at the same zoom. The seat scale and seat-top offset in `public/office-suits.js` are tuned against the standing scale, not the chair alone.
- After cropping the scene art, update the `.team-view` CSS `aspect-ratio` in `index.html` to the new pixel size. Otherwise the team panel shows a gap or clips the scene.
- Speech bubbles sit above heads with a z-index above sprites; check they are not hidden.
- Retire unused sprites by moving them to a sibling backup folder outside the repo, never deleting them. Then update the README art section to list only the folders that still exist.
- Scale characters from `Sf = min(H*.56, W*.24)`. On a 375 px viewport, crowded teammates collapse behind "+N".
- To test states, wrap `OfficeGame.update` with a mock project via javascript_exec, wait about 3 s, zoom, then re-read the DOM. Cover working, waiting, done, blocked, and return-to-desk.
- Verify at 1440x900 and 375x812, light and dark, per `browser-ui-verification`. Run `node --test tests/` after changes.

Layout and mobile collapse details: see `references/scene-layout.md`.