// Vice Rush entry point: builds the world, runs the frame loop, wires the
// debug hooks the play-test driver uses, and runs the ?shot= presets that
// produce the four screenshots.

import * as THREE from 'three';
import { World } from './world.js';
import { runShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotId = params.get('shot');
const seed = Number(params.get('seed') || 7);

const canvas = document.getElementById('game');
const world = new World(canvas);

window.__world = world;
window.__camera = world.camera;
window.__input = world.input;
window.__log = world._log;
window.__state = () => world.stateSnapshot();
window.__driveTo = (x, z) => world.driveTo(x, z);
window.__unstick = () => world.unstick();
window.__teleport = (x, z) => world.teleport(x, z);
window.__snapCamera = (x, y, z, tx, ty, tz) => world.snapCamera(x, y, z, tx, ty, tz);
window.__shotReady = false;

window.addEventListener('resize', () => {
  world.camera.aspect = window.innerWidth / window.innerHeight;
  world.camera.updateProjectionMatrix();
  world.renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
let shotStarted = false;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  // Keys that only matter outside the playing state.
  const input = world.input;
  if (world.state === 'title' && (input.pressed('Space') || input.pressed('Enter'))) {
    world.startGame();
  } else if (world.state === 'paused' && (input.pressed('KeyP') || input.pressed('Escape'))) {
    world.resume();
  } else if (world.state === 'result' && (input.pressed('Space') || input.pressed('Enter'))) {
    world.continueAfterResult();
  } else if ((world.state === 'busted' || world.state === 'wasted') && input.pressed('Enter')) {
    world.respawn(world.state);
  }

  if (shotId && !shotStarted) {
    shotStarted = true;
    world.startGame();
    runShot(world, shotId, seed).then(() => {
      world.frozen = true;
      world.step(0.016);
      window.__shotReady = true;
    }).catch((err) => {
      window.__shotError = String(err && err.message || err);
    });
  }

  world.step(dt);
  world.renderer.render(world.scene, world.camera);
  input.endFrame();
}

requestAnimationFrame(frame);
