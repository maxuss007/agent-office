# Agent Office scene layout notes

- Boss room on the left: `bossW = max(108, min(W*.3, 320))`. Bookshelf, picture and clock showing real time.
- Team area on the right: desks with two legs drawn by `.os .desk::before/::after` (`--leg` colour per theme).
- Monitors: `.os .mon` with a `--monb` border. Size `S*.19` for the boss, `S*.15` for others.
- Sprite widths: standing figures use `S*1.16`; the boss uses `Sf*1.08` capped at `H*.6`.
- Day and night follow the system colour scheme. Night shows lit windows and a moon.
- Legacy 3D scene is kept only at `public/index.legacy.html`.
