[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ranger-putih/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ranger-putih/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Rush — Sunset Bay

An open-world crime game in the spirit of GTA 6, built for the make.fun
`gta6-01` bounty. You are Raka, back in the coastal city of Sunset Bay with
$150 and a phone full of jobs from Mira. Drive, steal, shoot, outrun the
cops — and collect all ten hidden Sunset Coins.

## The city

Sunset Bay is a 400×400 m grid town with a beach and sea to the east and six
named districts: Downtown, Sunset Beach, Old Town, Harbor, North Hills and
South Docks. A full 24-hour day-night cycle runs from a golden 17:30 start —
lamps and market bulbs come on after dark, and the sky shifts from noon blue
to dusk orange to night.

## What is in the game

- **Five staged missions** with par times and gold/silver/bronze ratings,
  shown on a result screen after each job:
  1. **Package for Mira** — deliver a package to Beach Cafe (gold 45 s).
  2. **Hot Wheels** — steal the gold sports car, deliver it to the garage
     (gold 90 s).
  3. **Lose the Heat** — shake a 2-star wanted level (gold 30 s).
  4. **Sunset Sprint** — a six-checkpoint street race (gold 50 s).
  5. **Night Market Heat** — take down five crew members at the night
     market, then lose the cops (gold 120 s).
- **Sunset Coins** — ten hidden coins across all six districts, $25 each,
  tracked in the HUD and saved.
- **Police** — wanted levels 1–5 with decay, cruisers that chase and ram,
  foot cops that bust you, and a helicopter with a spotlight at 4 stars.
- **Combat** — fists and a pistol (magazine + reserve ammo, R reloads),
  mouse aim with a crosshair.
- **Driving** — five stealable parked vehicles (sedan, gold sports, SUV,
  pickup, bike) plus 20 traffic cars, car condition %, and 30 pedestrians.
- **Progression** — XP and ranks from Rookie to Kingpin, mission ratings
  saved, money and coins saved in localStorage.
- **HUD** — minimap with mission target, coins, police and gang blips;
  weapon slot + ammo; district name; clock; mission timer with gold par.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Drive / walk |
| Mouse | Aim (drag to orbit the camera) |
| Click | Punch / shoot |
| E | Enter / exit car |
| 1 / 2 | Fists / pistol |
| R | Reload |
| Shift | Sprint on foot |
| P / Esc | Pause |
| M | Mute |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files under `game/` (three.js vendored in
`game/vendor/three.min.js`) with no network requests. Screenshots live in
`screenshots/`; the dossier is built by `main.ts` with the kit's
`buildDossier`.

## Credits

Original game, city, characters and story — nothing from any commercial game.
Built with three.js and procedural WebAudio.
