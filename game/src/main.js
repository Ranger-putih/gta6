// Vice Rush — the entry point. It builds the renderer, the input, the HUD,
// the audio and the world, then runs one of two modes:
//   - a staged shot (?shot=start|drive|chase|mission&seed=1): the world is
//     staged, stepped a fixed number of fixed steps, painted, and the page
//     reports window.__shotReady so a screenshot can be taken;
//   - the live game: a title screen, then the loop, stepping the world on a
//     fixed timestep so the simulation never depends on the frame rate.
// A small window.__game accessor exposes the live state (and a teleport) so
// the game can be driven and checked from outside; it changes nothing about
// how the game plays.

import { CONFIG } from './config.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './render.js';
import { HUD } from './hud.js';
import { World } from './world.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;

const canvas = document.getElementById('game-canvas');
const hudRoot = document.getElementById('hud');
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const hud = new HUD(hudRoot);
const audio = new AudioEngine();
const world = new World(renderer, input, hud, audio, seed);

world.onBusted = () => {
  world.playing = false;
  hud.showScreen(hud.bustedScreen());
  const btn = document.getElementById('retry-btn');
  if (btn) btn.addEventListener('click', () => restart());
};
world.onWasted = () => {
  world.playing = false;
  hud.showScreen(hud.wastedScreen());
  const btn = document.getElementById('retry-btn');
  if (btn) btn.addEventListener('click', () => restart());
};

function restart() {
  world.respawn();
  world.playing = true;
  hud.showScreen(null);
  audio.click();
}

// A read-only view of the live state, plus a teleport for testing.
window.__game = {
  get state() {
    const p = world.player;
    return {
      x: p.x,
      z: p.z,
      heading: p.heading,
      money: p.money,
      health: p.health,
      wanted: world.police.wanted,
      inCar: p.inCar,
      speed: p.speed,
      missionsDone: world.missions.done.slice(),
      missionIndex: world.missions.index,
      missionStage: world.missions.stage,
      playing: world.playing,
      paused: world.paused,
      busted: world.busted,
      wasted: world.wasted,
    };
  },
  teleport(x, z, heading = world.player.heading) {
    world.putOnFoot(x, z, heading);
    renderer.snapTo(x, z, heading);
  },
  driveCar(name) {
    const car = world.parked.find((c) => c.name === name) || world.sportsCar;
    if (car) world.putInCar(car);
    return car ? car.name : null;
  },
  setWanted(n) {
    world.police.setWanted(n);
  },
  start() {
    audio.init();
    world.playing = true;
    hud.showScreen(null);
  },
};

window.addEventListener('resize', () => renderer.resize());

if (shotName) {
  // Staged shot: build the scene, paint a few frames, report ready.
  world.playing = true;
  stageShot(shotName, world);
  for (let i = 0; i < 6; i += 1) {
    renderer.render();
  }
  window.__shotReady = true;
} else {
  // Live game: the title screen waits for a start.
  hud.showScreen(hud.startScreen());
  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      audio.init();
      world.playing = true;
      hud.showScreen(null);
      audio.click();
    });
  }

  // Fixed-timestep loop: the simulation steps in 1/60s slices no matter how
  // fast or slow the display refreshes.
  let last = performance.now();
  let acc = 0;
  const DT = 1 / 60;
  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;
    acc += elapsed;
    while (acc >= DT) {
      world.step(DT);
      acc -= DT;
    }
    // Space or Enter also starts the game from the title screen.
    if (!world.playing && !world.busted && !world.wasted) {
      if (input.wasPressed('Space') || input.wasPressed('Enter')) {
        audio.init();
        world.playing = true;
        hud.showScreen(null);
      }
      input.endFrame();
    }
    // Pause overlay follows the world state.
    if (world.paused && world.playing) {
      if (!document.getElementById('resume-btn')) {
        hud.showScreen(hud.pauseScreen());
        const btn = document.getElementById('resume-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            world.togglePause();
            hud.showScreen(null);
          });
        }
      }
    } else if (!world.paused && document.getElementById('resume-btn')) {
      hud.showScreen(null);
    }
    renderer.render();
  }
  requestAnimationFrame(frame);
}
