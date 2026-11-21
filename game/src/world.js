// The world of Vice Rush: one object that owns the city, the player,
// the cars, the crowds, the police, the missions and the clock, and
// steps them all forward. main.js builds it, the game loop steps it,
// and the staged screenshots drive it by hand.

import * as THREE from 'three';
import {
  CITY_HALF, PLAYER_START, START_MONEY, TRAFFIC_COUNT, PED_COUNT,
  PARKED_CARS, SPORTS_CAR, MOTORCYCLE, DAY_START_HOUR,
  DAY_HOURS_PER_MINUTE, districtAt, rankFor,
} from './config.js';
import { buildCity, hitsCollider } from './city.js';
import { Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { input, ACTION_ENTER, ACTION_PAUSE, ACTION_MUTE, ACTION_PUNCH, ACTION_SHOOT, ACTION_WEAPON_1, ACTION_WEAPON_2 } from './input.js';
import { audio } from './audio.js';

const SAVE_KEY = 'vice-rush-save-v5';
const WALK_SPEED = 6;
const RUN_SPEED = 10;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.hud = null;
    this.state = 'title';
    this.city = buildCity(scene);
    this.collide = (x, z, r) => {
      if (Math.abs(x) > 238 || Math.abs(z) > 212) return true;
      return hitsCollider(this.city.colliders, x, z, r);
    };
    this.traffic = new Traffic(scene, this.collide);
    this.pedestrians = new Pedestrians(scene, this.collide);
    this.police = new Police(scene, this.collide);
    this.combat = new Combat();
    this.missions = new Missions(this);
    this.player = {
      x: PLAYER_START.x, z: PLAYER_START.z, heading: PLAYER_START.heading,
      speed: 0, onFoot: true, car: null, health: 100,
    };
    this.lastCar = null;
    this.money = START_MONEY;
    this.xp = 0;
    this.clockHours = DAY_START_HOUR;
    // The camera yaw is absolute: dragging turns it, walking follows
    // it, and driving settles it behind the car. It starts behind the
    // player, looking the way they face.
    this.camYaw = PLAYER_START.heading;
    this.camPitch = 0.25;
    this.camDist = 13;
    this.time = 0;
    this.parked = [];
    this.sportsCar = null;
    this.bike = null;
    this.spawnVehicles();
    this.traffic.spawn(TRAFFIC_COUNT);
    this.pedestrians.spawn(PED_COUNT);
    // The mission beacon: a yellow beam and a ring on the ground, marking
    // the current target so the player can see it from across the city.
    this.beacon = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd94d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 60, 10, 1, true), beamMat);
    beam.position.y = 30;
    this.beacon.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3, 4.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.beacon.add(ring);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.load();
  }

  spawnVehicles() {
    for (const def of PARKED_CARS) {
      const car = new Car(def.model, def.x, def.z, def.heading);
      car.parked = true;
      this.parked.push(car);
      this.scene.add(car.mesh);
    }
    this.sportsCar = new Car(SPORTS_CAR.model, SPORTS_CAR.x, SPORTS_CAR.z, SPORTS_CAR.heading);
    this.sportsCar.parked = true;
    this.scene.add(this.sportsCar.mesh);
    this.bike = new Car(MOTORCYCLE.model, MOTORCYCLE.x, MOTORCYCLE.z, MOTORCYCLE.heading);
    this.bike.parked = true;
    this.scene.add(this.bike.mesh);
  }

  // Every car the player can get into, parked or roaming.
  allCars() {
    return [...this.parked, this.sportsCar, this.bike, ...this.traffic.cars, ...this.police.cars];
  }

  nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.allCars()) {
      if (c === this.player.car) continue;
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  respawn() {
    const p = this.player;
    p.x = PLAYER_START.x;
    p.z = PLAYER_START.z;
    p.heading = PLAYER_START.heading;
    p.speed = 0;
    p.onFoot = true;
    p.car = null;
    p.health = 100;
    this.police.clear();
    this.pedestrians.clearGang();
    this.camYaw = PLAYER_START.heading;
    this.camPitch = 0.25;
    this.load();
    if (this.missions.done.length > 0) this.missions.restore(this.missions.done);
    else this.missions.start();
    this.state = 'playing';
  }

  putInCar(car, x, z, heading, speed) {
    const p = this.player;
    p.car = car;
    p.onFoot = false;
    car.x = x;
    car.z = z;
    car.heading = heading;
    car.speed = speed || 0;
    p.x = x;
    p.z = z;
    p.heading = heading;
    car.syncMesh();
  }

  putOnFoot(x, z, heading) {
    const p = this.player;
    p.car = null;
    p.onFoot = true;
    p.x = x;
    p.z = z;
    p.heading = heading;
    p.speed = 0;
  }

  addMoney(n) {
    this.money += n;
  }

  addXp(n) {
    const before = rankFor(this.xp).rank.name;
    this.xp += n;
    const after = rankFor(this.xp).rank.name;
    if (after !== before && this.hud) {
      this.hud.toast(`RANK UP — you are now ${after}`);
      audio.missionDone();
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.money, xp: this.xp, done: this.missions.done, ammo: this.combat.ammo,
      }));
    } catch (e) { /* private mode: the game still plays */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.money === 'number') this.money = s.money;
      if (typeof s.xp === 'number') this.xp = s.xp;
      if (Array.isArray(s.done)) this.missions.done = s.done;
      if (typeof s.ammo === 'number') this.combat.ammo = s.ammo;
    } catch (e) { /* a corrupt save is ignored */ }
  }

  get district() {
    return districtAt(this.player.x, this.player.z);
  }

  get rank() {
    return rankFor(this.xp);
  }

  get clockText() {
    const h = Math.floor(this.clockHours) % 24;
    const m = Math.floor((this.clockHours % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  enterCar() {
    const p = this.player;
    if (!p.onFoot) return;
    const car = this.nearestCar(3.6);
    if (!car) return;
    if (car.speed > 2) return;
    const stealing = car !== this.lastCar;
    p.car = car;
    p.onFoot = false;
    car.parked = false;
    car.driver = p;
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    if (stealing) {
      this.police.addWanted(1);
      this.hud.toast(`You took the ${car.model.name}`);
    }
    audio.pickup();
  }

  exitCar() {
    const p = this.player;
    if (p.onFoot || !p.car) return;
    const car = p.car;
    this.lastCar = car;
    const sideX = p.x + Math.cos(p.heading) * 2.2;
    const sideZ = p.z - Math.sin(p.heading) * 2.2;
    p.car = null;
    p.onFoot = true;
    p.speed = 0;
    if (!this.collide(sideX, sideZ, 0.6)) {
      p.x = sideX;
      p.z = sideZ;
    } else {
      p.x = car.x - Math.cos(p.heading) * 2.2;
      p.z = car.z + Math.sin(p.heading) * 2.2;
    }
    car.speed = 0;
    car.driver = null;
  }

  step(dt) {
    if (this.state !== 'playing') return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const p = this.player;

    // The clock: one game hour per real minute, starting at sunset.
    this.clockHours = (this.clockHours + dt * (DAY_HOURS_PER_MINUTE / 60)) % 24;

    // Camera orbit from the mouse drag; consume it each step.
    this.camYaw += input.orbit.x;
    input.orbit.x = 0;
    this.camPitch = Math.max(-0.2, Math.min(0.9, this.camPitch + input.orbit.y));
    input.orbit.y = 0;
    this.camDist = input.camDist;

    // Edge-triggered actions.
    for (const a of input.drain()) {
      if (a === ACTION_ENTER) {
        if (p.onFoot) this.enterCar();
        else this.exitCar();
      } else if (a === ACTION_PAUSE) {
        this.pause();
      } else if (a === ACTION_MUTE) {
        const muted = audio.toggleMute();
        this.hud.toast(muted ? 'Sound off' : 'Sound on');
      } else if (a === ACTION_WEAPON_1) {
        this.combat.switchWeapon('fists');
      } else if (a === ACTION_WEAPON_2) {
        this.combat.switchWeapon('pistol');
      } else if (a === ACTION_PUNCH) {
        if (p.onFoot) this.combat.punch(this);
      } else if (a === ACTION_SHOOT) {
        if (p.onFoot) this.combat.shoot(this);
      }
    }

    // Movement.
    if (p.onFoot) this.stepOnFoot(dt);
    else this.stepDriving(dt);

    // The city keeps moving.
    this.traffic.update(dt, p.car);
    this.pedestrians.update(dt);
    this.police.update(dt, p, () => this.busted());
    this.missions.update(dt);
    this.combat.update(dt);

    // A car that hits the player on foot hurts and shoves them.
    if (p.onFoot) {
      for (const c of this.traffic.cars) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < 1.8 && Math.abs(c.speed) > 4) {
          p.health -= 25;
          p.x += Math.sin(c.heading) * 3;
          p.z += Math.cos(c.heading) * 3;
          this.hud.toast('You were hit by a car!');
          audio.hit();
          break;
        }
      }
      for (const c of this.police.cars) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < 2.2 && Math.abs(c.speed) > 3) {
          p.health -= 20;
          this.hud.toast('A cruiser clipped you!');
          audio.hit();
          break;
        }
      }
    }

    // Slow health regen when the heat is off.
    if (this.police.wanted === 0 && p.health < 100) {
      p.health = Math.min(100, p.health + 2 * dt);
    }
    if (p.health <= 0) this.wasted();

    // Sound follows the drive and the chase.
    audio.engine(p.car ? Math.abs(p.car.speed) : 0, p.car ? p.car.model.top : 40);
    audio.siren(this.police.wanted > 0);

    // The beacon follows the mission target, pulsing as it turns.
    const target = this.missions.targetPos();
    if (target && this.state === 'playing') {
      this.beacon.visible = true;
      this.beacon.position.set(target.x, 0, target.z);
      const pulse = 0.7 + Math.sin(this.time * 4) * 0.3;
      this.beacon.children[0].material.opacity = 0.25 * pulse + 0.15;
      this.beacon.children[1].scale.setScalar(1 + Math.sin(this.time * 4) * 0.08);
    } else {
      this.beacon.visible = false;
    }

    if (this.hud) this.hud.update(this, dt);
  }

  stepOnFoot(dt) {
    const p = this.player;
    // A and D turn the player, and the camera swings with them.
    if (input.left) {
      p.heading += 1.9 * dt;
      this.camYaw += 1.9 * dt;
    }
    if (input.right) {
      p.heading -= 1.9 * dt;
      this.camYaw -= 1.9 * dt;
    }
    // W walks the way the camera looks; the player turns to face it.
    const speed = input.run ? RUN_SPEED : WALK_SPEED;
    let mx = 0;
    let mz = 0;
    if (input.forward) {
      mx += Math.sin(this.camYaw);
      mz += Math.cos(this.camYaw);
    }
    if (input.back) {
      mx -= Math.sin(this.camYaw) * 0.6;
      mz -= Math.cos(this.camYaw) * 0.6;
    }
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      const want = Math.atan2(mx, mz);
      p.heading += wrapAngle(want - p.heading) * Math.min(1, dt * 8);
      const nx = p.x + mx * speed * dt;
      const nz = p.z + mz * speed * dt;
      if (!this.collide(nx, p.z, 0.6)) p.x = nx;
      if (!this.collide(p.x, nz, 0.6)) p.z = nz;
      p.speed = speed;
    } else {
      p.speed = 0;
    }
  }

  stepDriving(dt) {
    const p = this.player;
    const car = p.car;
    if (!car) {
      p.onFoot = true;
      return;
    }
    const throttle = input.forward ? 1 : input.back ? -1 : 0;
    const steer = input.right ? 1 : input.left ? -1 : 0;
    if (car.health <= 0) {
      // Wrecked: it coasts to a stop and goes nowhere.
      car.speed *= Math.max(0, 1 - 2 * dt);
      car.syncMesh();
    } else {
      car.drive(dt, throttle, steer, this.collide);
    }
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    p.speed = car.speed;
    // The camera settles behind the car; a drag looks around, then it
    // drifts back.
    this.camYaw += wrapAngle(car.heading - this.camYaw) * Math.min(1, dt * 2.2);

    // Running over a pedestrian is a crime.
    for (const w of this.pedestrians.walkers) {
      if (!w.alive) continue;
      const d = Math.hypot(w.x - p.x, w.z - p.z);
      if (d < 1.9 && Math.abs(car.speed) > 3) {
        this.pedestrians.knockDown(w);
        this.police.addWanted(1);
        car.damage(2);
        this.hud.toast('You ran someone over — 1 star');
        audio.hit();
      }
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (this.hud) this.hud.showScreen('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    if (this.hud) this.hud.showScreen(null);
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.money = Math.max(0, this.money - 100);
    this.police.setWanted(0);
    this.save();
    audio.busted();
    if (this.hud) this.hud.showScreen('busted');
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.save();
    audio.busted();
    if (this.hud) this.hud.showScreen('wasted');
  }

  targetPos() {
    return this.missions.targetPos();
  }
}
