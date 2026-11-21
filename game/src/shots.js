// Staged scenes for the screenshots (?shot=start|drive|chase|mission).
// Each shot sets the world up, then steps it a fixed number of fixed-size
// steps, so the same seed always paints the same frame. The page loads fresh
// for every shot, so the world always starts clean: mission 1 active, no
// wanted level, the player at the spawn.
// Shot mode never runs the live loop and never reads the real keyboard: a
// scripted input stands in for it, so a drive or a chase can be staged
// without a hand on the keys.

import { CONFIG } from './config.js';

// A stand-in for Input with the same interface, driven by a script.
function scriptedInput(fwd, strafe) {
  return {
    held: () => false,
    wasPressed: () => false,
    wasClicked: () => false,
    moveAxes: () => ({ fwd, strafe }),
    running: () => false,
    endFrame: () => {},
    orbitX: 0,
    orbitY: 0,
    wheel: 0,
  };
}

function emptyInput() {
  return scriptedInput(0, 0);
}

// Step the world N fixed steps with the given scripted input.
function runSteps(world, steps, input) {
  const realInput = world.input;
  world.input = input;
  world.playing = true;
  for (let i = 0; i < steps; i += 1) {
    world.step(CONFIG.shots.dt);
  }
  world.input = realInput;
}

export function stageShot(name, world) {
  const steps = CONFIG.shots.steps;
  const dt = CONFIG.shots.dt;
  void dt;

  if (name === 'start') {
    // The title view: Raka on foot at the spawn, the city and the beach
    // ahead of him, traffic and walkers already moving.
    runSteps(world, steps, emptyInput());
    world.renderer.snapTo(world.player.x, world.player.z, world.player.heading);
    return;
  }

  if (name === 'drive') {
    // Raka in the red coupe on the coastal road, driving north with the sea
    // on his right and the city on his left.
    const coupe = world.parked.find((c) => c.name === 'Crimson Coupe') || world.parked[0];
    world.putInCar(coupe, coupe.x, coupe.z, Math.PI, 18);
    runSteps(world, steps, scriptedInput(1, 0));
    world.renderer.snapTo(world.player.x, world.player.z, world.player.heading);
    return;
  }

  if (name === 'chase') {
    // Three stars, three cruisers: Raka in the yellow sports car on the coast
    // road, the police closing in from behind.
    const sport = world.sportsCar;
    world.putInCar(sport, 192, 80, Math.PI, 15);
    world.police.setWanted(3);
    world.police.spawnCar(186, 55, 0);
    world.police.spawnCar(198, 48, 0);
    world.police.spawnCar(192, 105, Math.PI);
    runSteps(world, steps, scriptedInput(1, 0));
    world.renderer.snapTo(world.player.x, world.player.z, world.player.heading);
    return;
  }

  if (name === 'mission') {
    // Raka on foot on the sand, the Beach Cafe ahead and the yellow beacon
    // standing on the sand north of it, right where the package goes.
    world.putOnFoot(208, -18, Math.PI);
    runSteps(world, 30, emptyInput());
    world.renderer.snapTo(world.player.x, world.player.z, world.player.heading);
    return;
  }

  // An unknown shot name stages nothing; the world still renders.
  runSteps(world, steps, emptyInput());
}
