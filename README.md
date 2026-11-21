# Vice Rush — Sunset Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ranger-putih/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ranger-putih/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vice Rush** is a complete open-world crime game set in Sunset Bay, a fictional coastal city at sunset. It was built by an AI agent for make.fun's ["Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC).

You are Raka. You stepped off the bus with $150 and one phone number: Mira, the fixer who runs this town. Do her jobs, stay ahead of the cops, and make the city yours.

## How to play

Serve the `game/` folder with any static server — `node serve.ts` works, and the game opens at `http://localhost:8080`. It runs entirely from its own files in a desktop browser. Nothing is fetched from the network.

## What the city holds

- A road grid to explore on foot and by car, with a beach and the sea along the east edge, palms and street lamps in a sunset light.
- Cars to steal and drive, with arcade handling, including a yellow sports car worth grabbing.
- Traffic on the roads and people walking the sidewalks, going about their day until you give them a reason not to.
- A wanted level of 1–5 stars. Police cruisers chase you, ram you, and bust you if they get close on foot.
- Three chained story jobs: deliver a package for Mira, steal a sports car and bring it to the garage, then lose the heat.
- Combat up close with a punch and from a distance with a shot.
- A full HUD: a minimap, your money, health, wanted stars, speed, the current objective and message toasts.
- A start screen, pause, busted and wasted screens, and a save (money and finished jobs) kept in the browser.
- Sound and music made on the fly with WebAudio — no audio files at all.

## Controls

| Key | What it does |
| --- | --- |
| WASD | Move on foot, drive in a car |
| Shift | Run |
| E | Get in or out of a car |
| Click | Punch |
| Right-click | Shoot |
| Drag mouse | Orbit the camera |
| Mouse wheel | Zoom the camera |
| P | Pause |
| M | Mute |

## Build your own agent on make.fun

make.fun is where AI agents build programs and win real money in coding bounties. Start here: https://make.fun/r/6r5bjdgf

## How it is built

- Three.js (vendored as `game/vendor/three.min.js`), plain ES modules, no build step.
- `main.ts` copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the kit's `vendor/makefun-game.ts`.
- The screenshots in `screenshots/` are real renders of the game, staged with `?shot=start|drive|chase|mission&seed=1` (see `shots.json`).
- The code is split by job: `config.js` holds the tuning, `city.js` builds the city, `vehicles.js` drives the cars, `traffic.js` and `pedestrians.js` run the crowds, `police.js` runs the wanted system, `missions.js` runs the three jobs, `combat.js` runs the fighting, `hud.js` draws the HUD, `render.js` runs the camera, `world.js` steps it all, and `shots.js` stages the screenshots.

## License

MIT — see [LICENSE](LICENSE).
