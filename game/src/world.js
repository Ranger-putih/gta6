// World: the whole game state — player on foot and driving, the camera,
// coins, save/load, mission flow, the autopilot the play-test driver uses
// and the debug hooks. Step order each frame: input -> player -> traffic
// -> pedestrians -> police (wanted decay) -> missions -> coins -> HUD.
// Police runs before missions so an escape stage can never complete in the
// same frame its heat is applied.

import * as THREE from 'three';
import {
  WORLD, MISSIONS, COINS, COIN_VALUE, PARKED_CARS, PLAYER_SPAWN,
  SAVE_KEY, START_MONEY, START_HOUR,
} from './config.js';
import { buildCity, hitsCollider, pushOutOfColliders } from './city.js';
import { buildCarMesh, Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { Render } from './render.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const ROAD = WORLD.roadCoords;
function nearestRoad(v) {
  let best = ROAD[0];
  for (const c of ROAD) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
  return best;
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 90, 220);

    this.input = new Input();
    this.input.attach(canvas);
    this.audio = new AudioSys();
    this.hud = new Hud();
    this.render = new Render(this.scene, this.camera);
    this.city = buildCity(this.scene);
    this.render.bindCity(this.city);
    this.traffic = new Traffic(this.scene);
    this.pedestrians = new Pedestrians(this.scene);
    this.police = new Police(this.scene);
    this.combat = new Combat();
    this.missions = new Missions({
      onMissionStart: (m) => this.hud.toast(`${m.id} — ${m.name}`),
      onCheckpoint: (i, n) => {
        this.hud.toast(`Checkpoint ${i}/${n}`);
        this.audio.click();
      },
      onStageComplete: (s) => this.hud.toast(`Stage complete — ${s.label}`),
      onMissionComplete: (r) => this._onMissionComplete(r),
    });

    // Player.
    this.player = {
      x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, heading: PLAYER_SPAWN.heading,
      speed: 0, health: 100, onFoot: true, car: null,
    };
    this._buildPlayerMesh();
    this.ownedCars = new Set();
    this.money = START_MONEY;
    this.xp = 0;
    this.gameTime = 0;
    this.hour = START_HOUR;
    this.state = 'title';
    this.frozen = false;
    this.shotSpeedKmh = null;

    // Coins.
    this.coins = COINS.map((c, i) => ({ ...c, index: i, taken: false, mesh: null }));
    this._buildCoins();

    // Parked cars.
    this.parked = [];
    for (const def of PARKED_CARS) {
      const mesh = buildCarMesh(def.color, def.model);
      this.scene.add(mesh);
      const car = new Car(mesh, { model: def.model, name: def.name, x: def.x, z: def.z, heading: def.heading });
      car.mesh.position.set(def.x, 0, def.z);
      car.mesh.rotation.y = def.heading;
      this.parked.push(car);
    }

    // Autopilot (used by the play-test driver and by nobody else).
    this.autopilot = null;
    this._apLastPos = null;
    this._apStuckAt = 0;
    this._apRecoveries = 0;
    this._apReverseUntil = 0;

    // Camera rig.
    this.camYawOffset = 0;
    this.camPos = new THREE.Vector3(0, 90, 220);
    this.snapCam = null;

    this._log = [];
    this._load();
    this._wireButtons();
    this.hud.showScreen('title');
    this._updateHud();
  }

  log(...a) {
    const line = a.join(' ');
    this._log.push(line);
    if (this._log.length > 200) this._log.shift();
  }

  _buildPlayerMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 1.05, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a6a8a }),
    );
    body.position.y = 0.85;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
    );
    head.position.y = 1.62;
    group.add(head);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xd8a017 }),
    );
    cap.position.y = 1.82;
    group.add(cap);
    this.playerMesh = group;
    this.scene.add(group);
  }

  _buildCoins() {
    const geo = new THREE.TorusGeometry(0.9, 0.32, 10, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd94a });
    for (const c of this.coins) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x, 1.2, c.z);
      mesh.rotation.x = Math.PI / 2;
      mesh.visible = !c.taken;
      this.scene.add(mesh);
      c.mesh = mesh;
    }
  }

  _wireButtons() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { this.audio.resume(); this.audio.click(); fn(); });
    };
    on('start-btn', () => this.startGame());
    on('resume-btn', () => this.resume());
    on('restart-btn', () => this.restart());
    on('busted-btn', () => this.respawn('busted'));
    on('wasted-btn', () => this.respawn('wasted'));
    on('result-btn', () => this.continueAfterResult());
  }

  // ----- save / load -----
  _save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.money,
        xp: this.xp,
        done: this.missions.done,
        ratings: this.missions.ratings,
        coins: this.coins.filter((c) => c.taken).map((c) => c.index),
      }));
    } catch { /* storage is best-effort */ }
  }

  _load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.money === 'number') this.money = s.money;
      if (typeof s.xp === 'number') this.xp = s.xp;
      if (Array.isArray(s.done)) this.missions.done = s.done;
      if (s.ratings) this.missions.ratings = s.ratings;
      if (Array.isArray(s.coins)) {
        for (const i of s.coins) {
          if (this.coins[i]) {
            this.coins[i].taken = true;
            if (this.coins[i].mesh) this.coins[i].mesh.visible = false;
          }
        }
      }
    } catch { /* a corrupt save starts fresh */ }
  }

  // ----- state flow -----
  startGame() {
    this.audio.resume();
    this.state = 'playing';
    this.hud.showScreen('none');
    const next = MISSIONS.findIndex((m) => !this.missions.done.includes(m.id));
    if (next >= 0) {
      this.missions.startMission(next, this.gameTime, this.police);
    } else {
      this.hud.toast('All missions complete — free roam!');
    }
    this.log('game started');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showScreen('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.hud.showScreen('none');
  }

  restart() {
    this.state = 'playing';
    this.hud.showScreen('none');
    this.teleport(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
    this.player.heading = PLAYER_SPAWN.heading;
    this.player.health = 100;
  }

  continueAfterResult() {
    const more = this.missions.nextMission(this.gameTime, this.police);
    this.state = 'playing';
    this.hud.showScreen('none');
    if (!more) this.hud.toast('All missions complete — free roam! Sunset Bay is yours.');
  }

  respawn(from) {
    this.player.health = 100;
    this.police.setWanted(0);
    if (this.player.car) this.player.car = null;
    this.player.onFoot = true;
    this.teleport(PLAYER_SPAWN.x, PLAYER_SPAWN.z);
    this.player.heading = PLAYER_SPAWN.heading;
    this.state = 'playing';
    this.hud.showScreen('none');
    this.log(`respawned after ${from}`);
  }

  _onMissionComplete(result) {
    this.money += result.reward;
    this.xp += result.xp;
    this.combat.addAmmo(12);
    this._save();
    this.audio.missionDone();
    this.state = 'result';
    this.hud.showResult(result);
    this.log(`mission ${result.id} complete: ${result.rating} ${result.time.toFixed(1)}s +$${result.reward}`);
  }

  damage(amount, kind) {
    if (this.state !== 'playing') return;
    this.player.health = Math.max(0, this.player.health - amount);
    if (this.player.health <= 0) {
      this.money = Math.max(0, this.money - 150);
      this.state = 'wasted';
      this.hud.showScreen('wasted');
      this.log('wasted');
    }
  }

  // ----- cars -----
  nearestCar(maxDist = 4.5) {
    let best = null;
    let bestD = maxDist;
    let exited = null;
    let exitedD = maxDist;
    const all = [...this.parked, ...this.traffic.cars];
    for (const car of all) {
      const d = Math.hypot(car.x - this.player.x, car.z - this.player.z);
      if (d >= maxDist) continue;
      // Do not immediately re-enter the car just exited: the player
      // pressed E to get OUT, and the next E near two cars should pick
      // the other one (e.g. the M2 steal target parked beside the sedan).
      // But if it is the only car in range, it can be re-entered.
      if (car === this._lastExitedCar && performance.now() - this._lastExitedAt < 20000) {
        if (d < exitedD) { exited = car; exitedD = d; }
        continue;
      }
      if (d < bestD) { best = car; bestD = d; }
    }
    return best || exited;
  }

  enterCar(car) {
    if (this.player.car) return;
    if (car.isTraffic) this.traffic.remove(car);
    else {
      const i = this.parked.indexOf(car);
      if (i >= 0) this.parked.splice(i, 1);
    }
    this.player.car = car;
    this.player.onFoot = false;
    this.player.heading = car.heading;
    if (!this.ownedCars.has(car)) {
      this.ownedCars.add(car);
      car.stolen = true;
      this.police.addHeat(1);
      this.audio.wantedUp();
      this.hud.toast(`Stole the ${car.name} — wanted level up!`);
    }
    this.log(`entered car ${car.name}`);
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.speed = 0;
    const f = car.forward();
    this.player.x = car.x - f.x * 3;
    this.player.z = car.z - f.z * 3;
    this.player.heading = car.heading;
    this.player.car = null;
    this.player.onFoot = true;
    this._lastExitedCar = car;
    this._lastExitedAt = performance.now();
    this.parked.push(car);
    this.log(`exited car ${car.name}`);
  }

  teleport(x, z) {
    this.player.x = clamp(x, -196, 196);
    this.player.z = clamp(z, -196, 196);
    if (this.player.car) {
      this.player.car.x = this.player.x;
      this.player.car.z = this.player.z;
      this.player.car.speed = 0;
      this.player.car.mesh.position.set(this.player.x, 0, this.player.z);
    }
    this.player.speed = 0;
  }

  setHour(h) {
    const target = ((h - START_HOUR) % 24 + 24) % 24;
    this.gameTime = target * 60;
    this.hour = h;
  }

  // Put the player in a fresh car of the given model at a spot (shot mode).
  forceEnterCar(model, color, x, z, heading, name) {
    const mesh = buildCarMesh(color, model);
    this.scene.add(mesh);
    const car = new Car(mesh, { model, name: name || model, x, z, heading });
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = heading;
    this.ownedCars.add(car);
    this.player.car = car;
    this.player.onFoot = false;
    this.player.x = x;
    this.player.z = z;
    this.player.heading = heading;
    this.parked.push(car);
    return car;
  }

  // ----- autopilot -----
  // Public entry: (re)starts the autopilot and resets the recovery count.
  driveTo(x, z) {
    this._apRecoveries = 0;
    this._startAutopilot(x, z);
  }

  _startAutopilot(x, z) {
    const route = this._planRoute(this.player.x, this.player.z, x, z);
    this.autopilot = { waypoints: route, index: 0, tx: x, tz: z };
    this._apLastPos = { x: this.player.x, z: this.player.z };
    this._apStuckAt = performance.now();
    this._apReverseUntil = 0;
    this.log(`autopilot to ${x},${z} via ${route.length} waypoints`);
  }

  // Road-only routing: every leg runs on a road centre line. The start and
  // the target are first snapped to their nearest road point, then the
  // route goes through the nearest intersections — never diagonally across
  // a block, where buildings would wedge the car.
  _planRoute(sx, sz, tx, tz) {
    const a = { x: nearestRoad(sx), z: nearestRoad(sz) };
    const startOnRoad = Math.abs(sx - a.x) < Math.abs(sz - a.z)
      ? { x: a.x, z: sz } : { x: sx, z: a.z };
    const i1 = { x: nearestRoad(startOnRoad.x), z: nearestRoad(startOnRoad.z) };
    const i2 = { x: nearestRoad(tx), z: nearestRoad(tz) };
    const pts = [];
    const push = (p) => {
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 1) pts.push(p);
    };
    push(startOnRoad);
    push(i1);
    if (i1.z !== i2.z && i1.x !== i2.x) push({ x: i2.x, z: i1.z });
    push(i2);
    push({ x: tx, z: tz });
    return pts;
  }

  unstick() {
    // Snap the player (and car) back onto the nearest road centre line.
    const dx = Math.abs(this.player.x - nearestRoad(this.player.x));
    const dz = Math.abs(this.player.z - nearestRoad(this.player.z));
    if (dx < dz) this.player.x = nearestRoad(this.player.x);
    else this.player.z = nearestRoad(this.player.z);
    if (this.player.car) {
      this.player.car.x = this.player.x;
      this.player.car.z = this.player.z;
      this.player.car.speed = 0;
      this.player.car.mesh.position.set(this.player.x, 0, this.player.z);
    }
    this.player.speed = 0;
    this.log(`unstick to ${Math.round(this.player.x)},${Math.round(this.player.z)}`);
  }

  _autopilotStep(dt) {
    const ap = this.autopilot;
    if (!ap) return { throttle: 0, steer: 0, onFoot: this.player.onFoot };
    const now = performance.now();
    // Stuck detection: no real progress for 6 s -> snap back to a road and
    // re-plan; give up after 3 recoveries.
    if (this._apLastPos) {
      const moved = Math.hypot(this.player.x - this._apLastPos.x, this.player.z - this._apLastPos.z);
      if (moved > 1.5) {
        this._apLastPos = { x: this.player.x, z: this.player.z };
        this._apStuckAt = now;
      } else if (now - this._apStuckAt > 6000) {
        if (this._apRecoveries >= 3) {
          this.log('autopilot gave up (stuck)');
          this.autopilot = null;
          return { throttle: 0, steer: 0, onFoot: this.player.onFoot };
        }
        this._apRecoveries += 1;
        this.unstick();
        this._startAutopilot(ap.tx, ap.tz);
        return { throttle: 0, steer: 0, onFoot: this.player.onFoot };
      }
    }
    const wp = ap.waypoints[ap.index];
    if (!wp) {
      this.autopilot = null;
      return { throttle: 0, steer: 0, onFoot: this.player.onFoot };
    }
    const dx = wp.x - this.player.x;
    const dz = wp.z - this.player.z;
    const dist = Math.hypot(dx, dz);
    const isLast = ap.index === ap.waypoints.length - 1;
    const arriveR = this.player.onFoot ? (isLast ? 1.5 : 4) : (isLast ? 3.5 : 8);
    if (dist < arriveR) {
      ap.index += 1;
      if (ap.index >= ap.waypoints.length) {
        this.autopilot = null;
        if (this.player.car) this.player.car.speed *= 0.3;
        return { throttle: 0, steer: 0, onFoot: this.player.onFoot };
      }
      return { throttle: 0, steer: 0, onFoot: this.player.onFoot };
    }
    const want = Math.atan2(dx, dz);
    const err = wrapAngle(want - this.player.heading);
    if (this.player.onFoot) {
      this.player.heading = want;
      return { throttle: 1, steer: 0, onFoot: true };
    }
    // A dead car cannot drive: give up instead of steering a wreck.
    if (this.player.car.health <= 0) {
      this.autopilot = null;
      return { throttle: 0, steer: 0, onFoot: false };
    }
    const speed = Math.abs(this.player.car.speed);
    const steer = clamp(err * 2.2, -1, 1);
    let throttle;
    // Cap speed by distance to the waypoint so the car never arrives at a
    // tight market corner at full throttle and clips a stall.
    const desiredSpeed = clamp(dist * 0.7, 4, 26);
    if (Math.abs(err) > 2.0) {
      // Target behind: arc around FORWARD at low speed. Never reverse
      // blind — the first round-6 attempt wrecked the car by reversing
      // into the market stalls.
      throttle = 0.35;
    } else if (speed > desiredSpeed) {
      throttle = -0.5; // brake toward the corner
    } else if (!isLast && dist < 26 && Math.abs(err) > 0.9) {
      // Sharp turn at the next waypoint: brake if fast, else creep.
      throttle = speed > 4 ? -0.4 : 0.25;
    } else {
      throttle = Math.abs(err) < 0.5 ? 1 : 0.45;
    }
    if (isLast && dist < 16) throttle = Math.min(throttle, 0.4);
    return { throttle, steer, onFoot: false };
  }

  // ----- main step -----
  step(dt) {
    if (this.state === 'title') {
      const t = performance.now() / 1000;
      this.camera.position.set(Math.cos(t * 0.05) * 230, 95, Math.sin(t * 0.05) * 230);
      this.camera.lookAt(0, 0, 0);
      this.render.update(this.hour);
      return;
    }
    if (this.frozen) {
      this.render.update(this.hour);
      this._updateHud();
      return;
    }
    if (this.state !== 'playing') {
      this.render.update(this.hour);
      return;
    }
    // Fixed substeps so physics stays stable at low frame rates.
    let remaining = Math.min(dt, 0.12);
    while (remaining > 0) {
      const h = Math.min(remaining, 1 / 30);
      this._stepFixed(h);
      remaining -= h;
    }
    this._updateCamera(dt);
    this.render.update(this.hour);
    this._updateHud();
    this.input.endFrame();
  }

  _stepFixed(dt) {
    this.gameTime += dt;
    this.hour = START_HOUR + this.gameTime / 60;
    if (this.hour >= 24) this.hour -= 24;

    const input = this.input;
    const p = this.player;

    // Pause / mute / weapon keys.
    if (input.pressed('KeyP') || input.pressed('Escape')) { this.pause(); return; }
    if (input.pressed('KeyM')) {
      const muted = this.audio.toggleMute();
      this.hud.toast(muted ? 'Sound off (M)' : 'Sound on (M)');
    }
    if (input.pressed('Digit1')) this.combat.switchWeapon('1');
    if (input.pressed('Digit2')) this.combat.switchWeapon('2');
    if (input.pressed('KeyR')) this.combat.reload();
    const drag = input.consumeDrag();
    if (drag.x) this.camYawOffset = clamp(this.camYawOffset + drag.x * 0.004, -1.2, 1.2);

    // Any manual driving key cancels the autopilot.
    if (input.down('KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')) {
      this.autopilot = null;
    }

    // Enter / exit car.
    if (input.pressed('KeyE')) {
      if (p.car) this.exitCar();
      else {
        const car = this.nearestCar();
        if (car) this.enterCar(car);
      }
    }

    // Autopilot or manual control.
    let throttle = 0;
    let steer = 0;
    if (this.autopilot) {
      const ap = this._autopilotStep(dt);
      throttle = ap.throttle;
      steer = ap.steer;
      if (ap.onFoot && throttle) {
        p.speed = input.down('ShiftLeft', 'ShiftRight') ? 9 : 6;
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
        pushOutOfColliders(p, 0.9, this.city.colliders);
      }
    } else if (p.car) {
      const fwd = input.down('KeyW', 'ArrowUp') ? 1 : 0;
      const back = input.down('KeyS', 'ArrowDown') ? 1 : 0;
      throttle = fwd - back;
      steer = (input.down('KeyA', 'ArrowLeft') ? -1 : 0) + (input.down('KeyD', 'ArrowRight') ? 1 : 0);
    } else {
      const fwd = input.down('KeyW', 'ArrowUp') ? 1 : 0;
      const back = input.down('KeyS', 'ArrowDown') ? 1 : 0;
      const left = input.down('KeyA', 'ArrowLeft') ? 1 : 0;
      const right = input.down('KeyD', 'ArrowRight') ? 1 : 0;
      const moving = fwd - back;
      p.heading += (left - right) * 2.6 * dt * (moving >= 0 ? 1 : -1);
      if (moving !== 0 || left || right) {
        p.speed = input.down('ShiftLeft', 'ShiftRight') ? 9 : 6;
        const dir = moving !== 0 ? moving : 0;
        if (dir !== 0) {
          p.x += Math.sin(p.heading) * p.speed * dir * dt;
          p.z += Math.cos(p.heading) * p.speed * dir * dt;
        }
        pushOutOfColliders(p, 0.9, this.city.colliders);
        p.x = clamp(p.x, -196, 196);
        p.z = clamp(p.z, -196, 196);
      } else {
        p.speed = 0;
      }
    }

    // Drive the car.
    if (p.car) {
      if (p.car.health <= 0) {
        p.car.speed = Math.max(0, p.car.speed - 20 * dt);
        p.car.mesh.position.set(p.car.x, 0, p.car.z);
      } else {
        p.car.drive(throttle, steer, dt, this.city.colliders);
      }
      p.x = p.car.x;
      p.z = p.car.z;
      p.heading = p.car.heading;
      p.speed = p.car.speed;
    }

    // Player mesh follows.
    this.playerMesh.position.set(p.x, 0, p.z);
    this.playerMesh.rotation.y = p.heading;
    this.playerMesh.visible = true;

    // Combat: click to punch or shoot.
    if (input.consumeClick() && this.state === 'playing') {
      this.audio.resume();
      const report = this.combat.fire(this.camera, input.mouseX, input.mouseY, this.pedestrians, this.police, p);
      if (report) {
        if (report.weapon === 'pistol') {
          this.audio.shoot();
          this.police.commitCrime();
          if (this.police.wantedCount() < 1) this.police.setWanted(1);
        } else {
          this.audio.punch();
        }
        if (report.kind === 'gang-down') {
          this.police.addHeat(1);
          this.hud.toast('Crew member down!');
        } else if (report.kind === 'ped-down') {
          this.police.addHeat(2);
          this.hud.toast('You took down a pedestrian — the cops noticed!');
        } else if (report.kind === 'cop-down') {
          this.police.addHeat(2);
          this.hud.toast('Cop down! Wanted level up!');
        } else if (report.kind === 'hit') {
          this.hud.toast('Hit!');
        }
      }
    }
    this.combat.update(dt);

    // Traffic, pedestrians, police — police BEFORE missions (see header).
    const playerCar = p.car;
    this.traffic.update(dt, playerCar);
    const gangActive = this.missions.started && this.missions.stage() && this.missions.stage().type === 'eliminate';
    const onDamage = (amount, kind) => this.damage(amount, kind);
    this.pedestrians.update(dt, p, this.city.colliders, gangActive, onDamage);
    this.police.update(dt, p, this.city.colliders, () => this._onBusted(), onDamage);

    // Missions.
    if (this.missions.started) {
      this.missions.update(this.gameTime, {
        x: p.x, z: p.z, inCar: !!p.car, carName: p.car ? p.car.name : null,
        wanted: this.police.wantedCount(), crewLeft: this.pedestrians.crewLeft(),
        police: this.police,
      });
    }

    // Coins: spin, glow, pick up within 3.5 m on foot or by car.
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.z += dt * 2;
      c.mesh.position.y = 1.2 + Math.sin(this.gameTime * 2 + c.index) * 0.15;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 3.5) {
        c.taken = true;
        c.mesh.visible = false;
        this.money += COIN_VALUE;
        this.audio.coin();
        this.hud.toast(`☀ Sunset Coin! +$${COIN_VALUE} (${this.coins.filter((k) => k.taken).length}/10)`);
        this._save();
        this.log(`coin ${c.index} collected at ${c.place}`);
      }
    }

    // Engine hum.
    this.audio.engine(p.car ? Math.abs(p.car.speed) / p.car.stats.top : 0, !!p.car && Math.abs(p.speed) > 0.5);
  }

  _onBusted() {
    if (this.state !== 'playing') return;
    this.money = Math.max(0, this.money - 100);
    this.police.setWanted(0);
    this.state = 'busted';
    this.hud.showScreen('busted');
    this.log('busted');
  }

  _updateCamera(dt) {
    if (this.snapCam) {
      this.camera.position.set(this.snapCam.x, this.snapCam.y, this.snapCam.z);
      this.camera.lookAt(this.snapCam.tx, this.snapCam.ty, this.snapCam.tz);
      return;
    }
    const p = this.player;
    const dist = p.car ? 13 : 10;
    const height = p.car ? 5.5 : 4.5;
    const heading = p.heading + this.camYawOffset;
    const tx = p.x - Math.sin(heading) * dist;
    const tz = p.z - Math.cos(heading) * dist;
    const k = 1 - Math.exp(-dt * 6);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (height - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camera.position.copy(this.camPos);
    const f = { x: Math.sin(p.heading), z: Math.cos(p.heading) };
    this.camera.lookAt(p.x + f.x * 6, 1.6, p.z + f.z * 6);
  }

  snapCamera(x, y, z, tx, ty, tz) {
    this.snapCam = { x, y, z, tx, ty, tz };
  }

  clearSnapCamera() {
    this.snapCam = null;
  }

  // ----- HUD snapshot -----
  _updateHud() {
    const p = this.player;
    const m = this.missions;
    const target = m.started ? m.target() : null;
    const policePos = this.police.positions();
    this.hud.update({
      money: this.money,
      wanted: this.police.wantedCount(),
      health: p.health,
      speedKmh: this.shotSpeedKmh != null ? this.shotSpeedKmh : Math.abs(p.speed || 0) * 3.6,
      carName: p.car ? p.car.name : '',
      carHealth: p.car ? p.car.health : 0,
      weapon: this.combat.weapon,
      mag: this.combat.mag,
      reserve: this.combat.reserve,
      hour: this.hour,
      x: p.x,
      z: p.z,
      coins: this.coins.filter((c) => c.taken).length,
      coinsTotal: this.coins.length,
      xp: this.xp,
      missionName: m.started ? m.mission().name : '',
      missionId: m.started ? m.mission().id : '',
      stageLabel: m.started ? m.stageLabel() : '',
      missionActive: m.started,
      missionTime: m.missionTime(this.gameTime),
      parGold: m.started ? m.mission().gold : 0,
      targetDist: target ? Math.hypot(p.x - target.x, p.z - target.z) : null,
      target,
      crewLeft: m.started && m.stage().type === 'eliminate' ? this.pedestrians.crewLeft() : null,
      ratings: this.missions.ratings,
      inCar: !!p.car,
      heading: p.heading,
      state: this.state,
      mouseX: this.input.mouseX,
      mouseY: this.input.mouseY,
      hint: this.state === 'playing' && !p.car ? 'E — enter car   •   1/2 — weapon   •   P — pause' : '',
      coinDots: this.coins.filter((c) => !c.taken).map((c) => ({ x: c.x, z: c.z })),
      trafficDots: this.traffic.positions(),
      gangDots: this.pedestrians.aliveCrew().map((c) => ({ x: c.x, z: c.z })),
      policeDots: [...policePos.cruisers, ...policePos.cops],
      heliDot: policePos.heli,
    });
  }

  // Snapshot for the play-test driver and screenshots.
  stateSnapshot() {
    const p = this.player;
    const m = this.missions;
    const target = m.started ? m.target() : null;
    const { rank } = (() => {
      let r = 'Rookie';
      for (const row of [{ name: 'Rookie', xp: 0 }, { name: 'Wheelman', xp: 300 }, { name: 'Hustler', xp: 800 }, { name: 'Fixer', xp: 1500 }, { name: 'Kingpin', xp: 2500 }]) {
        if (this.xp >= row.xp) r = row.name;
      }
      return { rank: r };
    })();
    return {
      state: this.state,
      money: Math.floor(this.money),
      xp: this.xp,
      rank,
      mission: m.started ? m.mission().id : (m.done.length ? 'done' : 'none'),
      missionName: m.started ? m.mission().name : '',
      stageLabel: m.started ? m.stageLabel() : '',
      stageIndex: m.stageIndex,
      stageCount: m.started ? m.stageCount() : 0,
      missionTime: m.missionTime(this.gameTime),
      inCar: !!p.car,
      carName: p.car ? p.car.name : null,
      carHealth: p.car ? p.car.health : null,
      wanted: this.police.wantedCount(),
      health: Math.ceil(p.health),
      player: { x: p.x, z: p.z, heading: p.heading },
      ratings: { ...this.missions.ratings },
      done: [...this.missions.done],
      coins: this.coins.filter((c) => c.taken).length,
      coinsTotal: this.coins.length,
      target,
      crewLeft: this.pedestrians.crewLeft(),
      hour: this.hour,
      speedKmh: Math.abs(p.speed || 0) * 3.6,
    };
  }
}
