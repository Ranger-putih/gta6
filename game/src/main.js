// Vice Rush — the entry point. It builds the renderer, the world and
// the HUD, then either stages one frozen screenshot scene (?shot=) or
// runs the live game: title screen, Space to start, and a frame loop
// that steps the world and paints it. A few handles are left on window
// for play-testing and for the clip tools: __world, __screen, __log,
// __snapCamera, __camera and __input.

import { Render } from './render.js';
import { World } from './world.js';
import { Hud } from './hud.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { runShot } from './shots.js';

const container = document.getElementById('game');
const render = new Render(container);
const world = new World(render.scene);
const hud = new Hud();
world.hud = hud;
input.bind(render.canvas);
input.onPauseRequest = () => {
  if (world.state === 'playing') world.pause();
};

window.__world = world;
window.__camera = render.camera;
window.__input = input;
window.__log = [];
window.__snapCamera = () => render.snapCamera(world);
Object.defineProperty(window, '__screen', {
  get() { return world.state; },
});

function startGame() {
  audio.ensure();
  audio.click();
  world.respawn();
  hud.showScreen(null);
  window.__log.push({ type: 'startGame', t: world.time });
}

function endGame(kind) {
  window.__log.push({ type: 'endGame', kind, t: world.time });
  world.respawn();
  hud.showScreen('start');
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('resume-btn').addEventListener('click', () => {
  audio.click();
  world.resume();
});
document.getElementById('restart-btn').addEventListener('click', () => {
  startGame();
});
document.getElementById('busted-btn').addEventListener('click', () => endGame('busted'));
document.getElementById('wasted-btn').addEventListener('click', () => endGame('wasted'));

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10);

if (shot) {
  // Staged screenshot mode: pose the world, paint, signal readiness,
  // and never start the live loop.
  if (shot !== 'start') hud.showScreen(null);
  runShot(world, render, shot, Number.isFinite(seed) ? seed : 1);
} else {
  // The live game: title screen first, Space or a click to start.
  hud.showScreen('start');
  world.state = 'title';
  const onConfirm = () => {
    if (world.state === 'title') startGame();
  };
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.code === 'Enter') && world.state === 'title') {
      e.preventDefault();
      onConfirm();
    }
  });
  render.canvas.addEventListener('mousedown', () => {
    if (world.state === 'title') onConfirm();
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (world.state === 'playing') world.step(dt);
    render.updateDayNight(world.clockHours);
    render.follow(world, dt, false);
    render.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
