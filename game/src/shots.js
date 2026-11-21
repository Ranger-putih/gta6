// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps with scripted inputs, so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { STEP } from './config.js';

const NEUTRAL = { moveX: 0, moveY: 0, running: false, actions: 0 };

function stepFor(world, seconds, inputFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, inputFn(i), 0);
  }
}

/**
 * Set `world` to the named scene and return how to shoot it: the screen to
 * show, and either a fixed camera pose or follow-the-player.
 */
export function stageShot(name, world) {
  if (name === 'drive') {
    // Coastal road (x = 192): city skyline on the left, sand, palms and
    // the sea with the sunset on the right — the open view, not a canyon.
    const car = world.parked[2];
    world.putInCar(car, 192, 120, Math.PI, 24);
    stepFor(world, 4, () => ({
      moveX: 0,
      moveY: 1,
      running: false,
      actions: 0,
    }));
    return { screen: 'play', follow: true, pose: null };
  }
  if (name === 'chase') {
    // Two police head-on ahead of the player and one behind: they meet the
    // sports car, ram it and slow it, so the frame shows the chase pack
    // instead of an empty road after the player outran them.
    world.putInCar(world.sportsCar, 192, 80, Math.PI, 15);
    world.police.setWanted(3);
    world.police.spawnAt(186, 55, 0);
    world.police.spawnAt(198, 48, 0);
    world.police.spawnAt(192, 105, Math.PI);
    stepFor(world, 4, () => ({
      moveX: 0,
      moveY: 0.4,
      running: false,
      actions: 0,
    }));
    return { screen: 'play', follow: true, pose: null };
  }
  if (name === 'mission') {
    world.putOnFoot(198, -28, 2.47);
    stepFor(world, 2, () => NEUTRAL);
    return { screen: 'play', follow: true, pose: null };
  }
  // start (and anything else): a wide sunset view of the city with the title.
  stepFor(world, 5, () => NEUTRAL);
  return {
    screen: 'title',
    follow: false,
    pose: { x: -60, y: 70, z: 175, lookX: 120, lookY: 5, lookZ: -60 },
  };
}
