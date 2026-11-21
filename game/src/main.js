// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, the camera follows, and the HUD paints what is there.
// The game moves between four screens: title, play, paused and game over.
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it a few times and
// sets window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(createRandom(Date.now() % 2147483647).next() * 4294967296);

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const audio = createAudio();
const hud = createHud();
const world = createWorld(renderer.scene, seed, audio);
const input = createInput(canvas);

let bestMoney = 150;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData()));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}
const save = readSave();
if (save) {
  world.loadSave(save);
  bestMoney = Math.max(150, save.bestMoney || save.money || 150);
}

let camHeading = 0;
const orbit = { x: 0, y: 0.35 };
let camDist = 10;

function runShot(name) {
  const staged = stageShot(name, world);
  hud.setMoney(world.player.money);
  hud.setWanted(world.police.wanted);
  hud.setHealth(world.player.health);
  hud.setObjective(world.missions.objectiveText());
  if (staged.screen === 'title') {
    hud.showTitle(bestMoney, world.missions.done.length);
    if (staged.pose) {
      renderer.setPose(staged.pose.x, staged.pose.y, staged.pose.z, staged.pose.lookX, staged.pose.lookY, staged.pose.lookZ);
    }
  } else {
    hud.showPlay();
    hud.setSpeed(world.player.car ? Math.abs(world.player.car.speed) * 3.6 : 0, !!world.player.car);
  }
  hud.drawMinimap(world.minimapView(), world.time);
  // Staged shots use a higher, farther chase camera than live play so the
  // frame shows the street, the city around it and the sky, not one wall.
  const shotOrbit = { x: 0, y: 0.5 };
  const shotDist = world.player.car ? 17 : 13;
  let painted = 0;
  function paint() {
    if (staged.follow) {
      // First frame: snap the camera straight to the follow pose (dt 10
      // makes the smoothing factor ~1), then ease for a few frames so the
      // shot is stable before the screenshot is taken.
      renderer.follow(world.player, shotOrbit, shotDist, painted === 0 ? 10 : 1 / 60);
    }
    renderer.render();
    painted += 1;
    if (painted < 6) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = 'title';
  let overKind = '';
  let accumulator = 0;
  let last = performance.now();

  function startGame() {
    world.respawn();
    screen = 'play';
    hud.showPlay();
    hud.message('Welcome to Sunset Bay. Follow the yellow marker.');
  }

  function endGame(kind) {
    screen = 'over';
    overKind = kind;
    audio.music(false);
    if (kind === 'busted') {
      audio.busted();
      const fine = Math.min(100, world.player.money);
      world.player.money -= fine;
      hud.showOver('BUSTED', `The cops caught you. You paid $${fine} in fines. Press Space to get back out there.`);
    } else {
      const lost = Math.min(150, world.player.money);
      world.player.money -= lost;
      hud.showOver('WASTED', `You did not make it. You lost $${lost}. Press Space to try again.`);
    }
    writeSave();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === 'title' || screen === 'over') startGame();
      else if (screen === 'pause') {
        screen = 'play';
        hud.showPlay();
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'pause';
        hud.showPause();
      } else if (screen === 'pause') {
        screen = 'play';
        hud.showPlay();
      }
    }
    return actions;
  }

  function updateHud() {
    const player = world.player;
    hud.setMoney(player.money);
    hud.setWanted(world.police.wanted);
    hud.setHealth(player.health);
    hud.setObjective(world.missions.objectiveText());
    hud.setSpeed(player.car ? Math.abs(player.car.speed) * 3.6 : 0, !!player.car);
    // Interaction prompt.
    if (player.car) {
      hud.prompt('E — Exit car');
    } else {
      const near = world.parked.concat([world.sportsCar]).some(
        (car) => !car.disabled && Math.hypot(car.x - player.x, car.z - player.z) < 4.5,
      );
      hud.prompt(near ? 'E — Get in car' : '');
    }
    hud.drawMinimap(world.minimapView(), world.time);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const look = input.takeLook();
    orbit.x += look.x * 0.004;
    orbit.y = Math.max(0.08, Math.min(0.9, orbit.y + look.y * 0.003));
    const zoom = input.takeZoom();
    if (zoom) camDist = Math.max(7, Math.min(18, camDist + zoom * 0.01));
    const actions = handleActions();
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === 'title' || screen === 'play') {
      // One-shot presses apply to the first step only, never twice.
      let pendingActions = actions;
      while (accumulator >= STEP && (screen === 'title' || screen === 'play')) {
        const stepInput = {
          moveX: screen === 'play' ? input.moveX() : 0,
          moveY: screen === 'play' ? input.moveY() : 0,
          running: input.isRunning(),
          actions: screen === 'play' ? pendingActions : 0,
        };
        pendingActions = 0;
        const events = world.step(STEP, stepInput, camHeading);
        accumulator -= STEP;
        events.forEach((event) => {
          if (event.type === 'message') hud.message(event.text);
          else if (event.type === 'damage') hud.flashDamage();
          else if (event.type === 'mission-complete') writeSave();
          else if (event.type === 'busted') endGame('busted');
          else if (event.type === 'wasted') endGame('wasted');
        });
        if (screen === 'over') break;
      }
    } else {
      accumulator = 0;
    }
    const dist = world.player.car ? 13 : 9.5;
    camDist += (dist - camDist) * 0.05;
    renderer.follow(world.player, orbit, camDist, 1 / 60);
    camHeading = Math.atan2(
      world.player.x - renderer.camera.position.x,
      world.player.z - renderer.camera.position.z,
    );
    renderer.render();
    if (screen === 'play') updateHud();
  }

  // Leaving the tab pauses a running game.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'pause';
      hud.showPause();
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') audio.setMuted(!audio.isMuted());
  });

  // Clicking a full-screen overlay starts the game too (the canvas is
  // covered there, so its own pointer handler never fires).
  ['screen-title', 'screen-over'].forEach((id) => {
    document.getElementById(id).addEventListener('pointerdown', () => {
      audio.unlock();
      if (screen === 'title' || screen === 'over') startGame();
    });
  });

  hud.showTitle(bestMoney, world.missions.done.length);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
