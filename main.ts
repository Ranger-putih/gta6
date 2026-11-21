// Vice Rush, handed in for make.fun's gta6-01 (Node 22, standard
// library only). The game is the static files under game/: an open
// world called Sunset Bay, built on three.js, that a desktop browser
// opens offline and plays with keyboard and mouse — a coastal city to
// explore on foot and by car, traffic and pedestrians, cars to steal, a
// wanted level with police and a helicopter, five chained missions with
// stages and a race timer, combat, and a HUD with a minimap, a rank bar
// and a day-night clock. The five jobs run in order: a delivery, a car
// theft, an escape, a checkpoint race at sunset, and a gang clear-out
// at the Night Market. Nothing in it phones home: every script, image
// and sound the page loads is a file under game/ or a data URI.
//
// What this program does is only the hand-in: it copies game/ and
// screenshots/ from beside this file into /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. The four screenshots are real renders of the
// game's own code, taken with ?shot=drive, chase, mission and start.
// Serve the game locally with `node serve.ts`, then open
// http://localhost:8080. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
