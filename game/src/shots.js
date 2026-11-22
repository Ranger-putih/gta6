// Screenshot presets: pose the world for each of the four dossier shots,
// let the simulation settle for a few frames, then signal ready. The main
// loop freezes the world right after so the frame the driver captures is
// exactly the posed one.

import { SHOTS } from './config.js';

function waitFrames(n) {
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      i += 1;
      if (i >= n) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function settle(world, frames = 24) {
  return waitFrames(frames);
}

async function presetHeli(world) {
  // Night helicopter chase: 4 stars, sports car speeding up the x=0 road,
  // cruisers behind, spotlight cone from the heli above.
  world.setHour(22.2);
  const car = world.forceEnterCar('sports', 0xd8a017, 0, 60, Math.PI, 'Gold Sports');
  car.speed = 26;
  world.police.setWanted(4);
  world.missions.startMission(3, world.gameTime, world.police);
  world.missions.checkpointIndex = 1;
  world.missions.startTime = world.gameTime - 24;
  await settle(world, 30);
  // Cruisers spawn near the player; pull two of them into frame behind.
  const cruisers = world.police.cruisers;
  if (cruisers[0]) { cruisers[0].x = 6; cruisers[0].z = 96; cruisers[0].heading = Math.PI; }
  if (cruisers[1]) { cruisers[1].x = -6; cruisers[1].z = 108; cruisers[1].heading = Math.PI; }
  world.shotSpeedKmh = 96;
  world.snapCamera(11, 5.5, 86, 0, 2, 34);
}

async function presetMarket(world) {
  // Night Market shootout: on foot with the pistol, crew around the stalls,
  // wanted 2, M5 eliminate stage live.
  world.setHour(21.5);
  world.teleport(-150, 152);
  world.player.heading = Math.atan2(-10, 8);
  world.combat.switchWeapon('2');
  world.combat.mag = 12;
  world.combat.reserve = 24;
  world.missions.startMission(4, world.gameTime, world.police);
  world.missions.stageIndex = 1;
  world.missions.startTime = world.gameTime - 41;
  world.police.setWanted(2);
  await settle(world, 24);
  world.snapCamera(-143, 4.6, 146, -160, 1.5, 162);
}

async function presetRace(world) {
  // Sunset Sprint at dusk: sports car past the first checkpoint, racing
  // east toward the next one, timer and gold par on the HUD.
  world.setHour(18.6);
  world.missions.startMission(3, world.gameTime, world.police);
  world.missions.checkpointIndex = 1;
  world.missions.startTime = world.gameTime - 24;
  const car = world.forceEnterCar('sports', 0xd8a017, 12, 80, Math.PI / 2, 'Gold Sports');
  car.speed = 30;
  world.shotSpeedKmh = 112;
  await settle(world, 24);
  world.snapCamera(-4, 5.5, 80, 44, 1.5, 80);
}

async function presetDusk(world) {
  // Rush hour at dusk in Downtown: sedan in dense traffic, pedestrians on
  // the sidewalks, sunset sky.
  world.setHour(17.8);
  const car = world.forceEnterCar('sedan', 0x3f6fb5, 0, 20, 0, 'Sunset Sedan');
  car.speed = 14;
  world.shotSpeedKmh = 52;
  // Pack traffic onto the roads around Downtown for a busy frame.
  const spots = [
    [0, -40, 0], [0, 52, Math.PI], [80, 8, Math.PI / 2], [-80, -8, -Math.PI / 2],
    [80, 44, Math.PI], [-80, 44, 0], [0, -80, Math.PI / 2], [80, -40, -Math.PI / 2],
  ];
  world.traffic.cars.forEach((c, i) => {
    const s = spots[i % spots.length];
    c.x = s[0] + (i % 3) * 2;
    c.z = s[1];
    c.heading = s[2];
    c.speed = 6;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
  });
  // Pedestrians near the intersection.
  world.pedestrians.walkers.forEach((w, i) => {
    if (i < 12) {
      w.x = ((i % 4) - 1.5) * 12;
      w.z = (Math.floor(i / 4) - 1) * 14 + 8;
      w.mesh.position.set(w.x, 0, w.z);
    }
  });
  await settle(world, 24);
  world.snapCamera(2, 6, 4, 0, 1.5, 52);
}

const PRESETS = {
  heli: presetHeli,
  market: presetMarket,
  race: presetRace,
  dusk: presetDusk,
};

export const SHOT_STEPS = Object.keys(PRESETS);

export async function runShot(world, shotId, seed) {
  const preset = PRESETS[shotId];
  if (!preset) throw new Error(`unknown shot ${shotId}`);
  const shot = SHOTS.find((s) => s.id === shotId);
  if (shot && shot.seed !== seed) {
    // Seed is recorded for reproducibility; the layout is deterministic.
  }
  await preset(world);
}
