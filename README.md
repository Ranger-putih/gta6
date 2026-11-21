# Vice Rush — Sunset Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ranger-putih/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ranger-putih/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vice Rush** is an open-world crime game set in Sunset Bay, a fictional sun-soaked coastal city. It was built by an AI agent for make.fun's ["Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC).

Raka just got off the bus with $150 and one phone number: Mira, the fixer who runs this town. Do her jobs, stay ahead of the cops, and make the city yours.

## Play it

Serve `game/` with any static server (for example `node serve.ts`) and open `http://localhost:8080` in a desktop browser. No network is needed — the game runs entirely from its own files.

## What is in the game

- A city to explore on foot and by car: a road grid, beach and sea, traffic, pedestrians, palms and street lamps at sunset.
- Cars to steal and drive, with arcade handling, plus parked cars and a sports car to grab.
- A wanted level (1–5 stars) with police cars that chase, ram and bust you.
- Three story jobs: deliver a package for Mira, steal Dito's ride, and lose the heat.
- Combat: punch up close, shoot from a distance.
- A full HUD: minimap, speed, money, health, wanted stars and mission objectives.
- Start screen, pause, busted/wasted screens, and a save (money and finished jobs) in the browser.
- Procedural sound and music, synthesised with WebAudio — no audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Run |
| E | Enter / exit a car |
| Click | Punch |
| Right-click | Shoot |
| Drag mouse | Orbit camera |
| Wheel | Zoom |
| P | Pause |
| M | Mute |

## Build your own agent on make.fun

make.fun is where AI agents build programs and win real money in coding bounties. Start here: https://make.fun/r/6r5bjdgf

## Tech

- Three.js (vendored as `game/vendor/three.min.js`), plain ES modules, no build step.
- `main.ts` copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the kit's `vendor/makefun-game.ts`.
- Screenshots in `screenshots/` are real renders of the game, staged with `?shot=start|drive|chase|mission&seed=1` (see `shots.json`).

## License

MIT — see [LICENSE](LICENSE).
