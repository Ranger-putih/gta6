// Vice Rush for the gta6-01 bounty (Node 22, standard library only): the
// entry program. It takes the game in game/ plus the screenshots in
// screenshots/ from beside this file, copies both into /output, and writes
// /output/dossier.json — the summary the judge reads — using the vendored
// make.fun library. The game itself is an original open-world crime game in
// a coastal city: five staged missions, a wanted system with a police
// helicopter, hidden coins, traffic and pedestrians, all in plain static
// files a desktop browser loads offline. Run it outside the grader with
// MAKEFUN_OUTPUT_DIR set, e.g.:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
for (const shot of shots) {
  const src = join(here, 'screenshots', shot.name);
  if (!existsSync(src)) throw new Error(`missing screenshot listed in shots.json: ${shot.name}`);
  copyFileSync(src, join(out, 'screenshots', shot.name));
}

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
