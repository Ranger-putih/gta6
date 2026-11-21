// The staged screenshots. The kit asks for a shot with ?shot=<name>
// and &seed=<n>; this module puts the world in that exact pose, steps
// it a fixed number of times, paints a few frames so the camera and the
// traffic settle, and sets window.__shotReady. The live game never runs
// in shot mode — the world is frozen in its pose, which is what makes
// the screenshots deterministic for the same seed.

import { fixedRng } from './random.js';

export const SHOT_STEPS = {
  start: 30,
  drive: 260,
  chase: 220,
  mission: 200,
};

export function runShot(world, render, shot, seed) {
  const rng = fixedRng(seed || 1);
  void rng;
  world.state = 'playing';
  world.respawn();
  // Missions start at the first job so the objective and the beacon
  // show in every shot that has them.
  world.missions.start();

  if (shot === 'start') {
    // Title screen: the player on foot at the start, camera high and
    // wide over Downtown at sunset.
    world.putOnFoot(10, 24, Math.PI);
    world.camYaw = Math.PI;
    world.camPitch = 0.7;
    world.camDist = 26;
    world.state = 'title';
  } else if (shot === 'drive') {
    // The red sedan rolling down the beach road.
    const car = world.parked[0];
    world.putInCar(car, 160, 120, Math.PI, 24);
    world.camYaw = Math.PI;
    world.camDist = 10.5;
  } else if (shot === 'chase') {
    // The yellow sports car, three stars, cruisers closing in.
    world.putInCar(world.sportsCar, 192, 80, Math.PI, 15);
    world.police.setWanted(3);
    world.police.spawnAt(186, 55, 0);
    world.police.spawnAt(198, 48, 0);
    world.police.spawnAt(192, 105, Math.PI);
    world.camYaw = Math.PI;
    world.camDist = 11;
  } else if (shot === 'mission') {
    // The package run: the player in the red sedan near the Beach Cafe,
    // the yellow beacon standing on the sand.
    const car = world.parked[0];
    world.putInCar(car, 190, -30, Math.PI / 2, 0);
    world.camYaw = Math.PI / 2;
    world.camDist = 12;
  } else {
    world.putOnFoot(10, 24, Math.PI);
  }

  // Step the world a fixed number of times so traffic, pedestrians and
  // the camera settle into the same pose for the same seed.
  const steps = SHOT_STEPS[shot] || 120;
  const dt = 1 / 60;
  for (let i = 0; i < steps; i++) {
    if (world.state === 'playing') world.step(dt);
  }
  // The staged speedometer reading: the car coasts to a stop with no
  // input, so put the staged speed back on before painting.
  if (!world.player.onFoot && world.player.car) {
    const staged = shot === 'drive' ? 24 : shot === 'chase' ? 15 : 0;
    world.player.car.speed = staged;
    world.player.speed = staged;
  }
  // Paint a few frames so the renderer and the camera finish settling.
  for (let i = 0; i < 6; i++) {
    render.follow(world, dt, i === 5);
    render.updateDayNight(world.clockHours);
    render.render();
  }
  window.__shotReady = true;
}
