// The world: everything that lives in Sunset Bay, stepped once a frame.
// It owns the player, the parked cars, the traffic, the walkers, the police,
// the missions and the combat, and it is the only file that knows how they
// all talk to each other. main.js creates it; shots.js stages it.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRng, clamp, dist2d } from './random.js';
import { City } from './city.js';
import { makeCarMesh, makeCar, syncCarMesh, driveCar } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';

const SAVE_KEY = 'vice-rush-save-v1';

export class World {
  constructor(renderer, input, hud, audio, seed) {
    this.renderer = renderer;
    this.input = input;
    this.hud = hud;
    this.audio = audio;
    this.rng = createRng(seed ?? CONFIG.world.seed);
    this.elapsed = 0;
    this.playing = false;
    this.paused = false;
    this.busted = false;
    this.wasted = false;
    this.onBusted = null;
    this.onWasted = null;

    this.city = new City(renderer.scene, this.rng);
    this.traffic = new Traffic(renderer.scene, this.city, this.rng);
    this.pedestrians = new Pedestrians(renderer.scene, this.rng);
    this.police = new Police(renderer.scene, this.city);
    this.missions = new Missions(renderer.scene);
    this.combat = new Combat();

    this.player = this.makePlayer();
    renderer.scene.add(this.player.mesh);

    // Parked cars the player can steal, plus the yellow sports car.
    this.parked = [];
    for (const spec of CONFIG.parkedCars) {
      const mesh = makeCarMesh(spec.color);
      renderer.scene.add(mesh);
      const car = makeCar(mesh, spec.x, spec.z, spec.heading);
      car.name = spec.name;
      this.parked.push(car);
      syncCarMesh(car);
    }
    const sportMesh = makeCarMesh(0xf2c230, true);
    renderer.scene.add(sportMesh);
    this.sportsCar = makeCar(sportMesh, CONFIG.sportsCar.x, CONFIG.sportsCar.z, CONFIG.sportsCar.heading);
    this.sportsCar.name = "Dito's Ride";
    this.sportsCar.isSportsCar = true;
    this.parked.push(this.sportsCar);
    syncCarMesh(this.sportsCar);

    this.loadSave();
    this.player.money = this.savedMoney ?? CONFIG.player.startMoney;
    if (this.savedDone) {
      for (const id of this.savedDone) {
        const idx = CONFIG.missions.findIndex((m) => m.id === id);
        if (idx >= 0 && idx === this.missions.index) {
          this.missions.done.push(id);
          this.missions.index += 1;
        }
      }
      this.missions.updateBeacon();
    }
  }

  makePlayer() {
    const group = new THREE.Group();
    // Raka: a bright orange shirt, dark shorts, a cap. He reads as the
    // player because nobody else in the city wears that orange.
    const shirt = new THREE.MeshStandardMaterial({ color: 0xe86a2a, roughness: 0.85 });
    const shorts = new THREE.MeshStandardMaterial({ color: 0x2e3a4a, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.85, 8), shirt);
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), skin);
    head.position.y = 1.62;
    head.castShadow = true;
    group.add(head);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x2e6db0, roughness: 0.8 }),
    );
    cap.position.y = 1.82;
    group.add(cap);
    for (const sx of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 6), shorts);
      leg.position.set(sx, 0.28, 0);
      group.add(leg);
    }
    return {
      mesh: group,
      x: CONFIG.player.start.x,
      z: CONFIG.player.start.z,
      heading: CONFIG.player.start.heading,
      speed: 0,
      health: CONFIG.player.health,
      money: CONFIG.player.startMoney,
      inCar: false,
      car: null,
      walkPhase: 0,
      ramCooldown: 0,
    };
  }

  // Place the player on foot at (x, z) facing `heading`.
  putOnFoot(x, z, heading) {
    const p = this.player;
    p.inCar = false;
    p.car = null;
    p.x = x;
    p.z = z;
    p.heading = heading;
    p.speed = 0;
    p.mesh.visible = true;
    p.mesh.position.set(x, 0, z);
    p.mesh.rotation.y = heading;
  }

  // Put the player in a car (the car becomes the player's car).
  putInCar(car, x = car.x, z = car.z, heading = car.heading, speed = 0) {
    const p = this.player;
    p.inCar = true;
    p.car = car;
    p.x = x;
    p.z = z;
    p.heading = heading;
    p.speed = speed;
    car.x = x;
    car.z = z;
    car.heading = heading;
    car.speed = speed;
    p.mesh.visible = false;
    syncCarMesh(car);
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
  }

  respawn() {
    this.police.setWanted(0);
    this.police.busted = false;
    this.busted = false;
    this.wasted = false;
    this.player.health = CONFIG.player.health;
    this.putOnFoot(CONFIG.player.start.x, CONFIG.player.start.z, CONFIG.player.start.heading);
  }

  toast(text, seconds) {
    this.hud.toast(text, seconds);
  }

  save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.player.money,
        done: this.missions.done,
      }));
    } catch {
      // A browser that refuses storage just does not save. The game plays on.
    }
  }

  loadSave() {
    this.savedMoney = null;
    this.savedDone = null;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.money === 'number') this.savedMoney = data.money;
      if (Array.isArray(data.done)) this.savedDone = data.done;
    } catch {
      // A corrupt save is ignored, not fatal.
    }
  }

  // The nearest parked car within reach, if any.
  nearestParkedCar(maxDist = 3.2) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.parked) {
      const d = dist2d(this.player.x, this.player.z, car.x, car.z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  // One fixed step of the whole simulation.
  step(dt) {
    this.elapsed += dt;
    const p = this.player;
    const input = this.input;

    if (this.playing && !this.paused) {
      // --- Movement ---
      if (p.inCar && p.car) {
        const axes = input.moveAxes();
        // W/S is throttle, A/D is steering. D decreases the heading.
        driveCar(p.car, dt, axes.fwd, -axes.strafe, this.city.colliders,
          (x, z, r) => this.city.resolveCircle(x, z, r));
        p.x = p.car.x;
        p.z = p.car.z;
        p.heading = p.car.heading;
        p.speed = p.car.speed;
      } else {
        // On foot, W walks away from the camera (camera-relative).
        const cam = this.renderer.camPos;
        const camHeading = Math.atan2(p.x - cam.x, p.z - cam.z);
        const axes = input.moveAxes();
        const fx = Math.sin(camHeading);
        const fz = Math.cos(camHeading);
        const rx = -Math.cos(camHeading);
        const rz = Math.sin(camHeading);
        const speed = input.running() ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
        const mx = (fx * axes.fwd + rx * axes.strafe) * speed * dt;
        const mz = (fz * axes.fwd + rz * axes.strafe) * speed * dt;
        if (mx !== 0 || mz !== 0) {
          // Face where we walk.
          const want = Math.atan2(mx, mz);
          let diff = want - p.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff <= -Math.PI) diff += Math.PI * 2;
          p.heading += clamp(diff, -dt * 10, dt * 10);
          p.walkPhase += dt * speed * 1.6;
        }
        let nx = clamp(p.x + mx, -CONFIG.world.half + 1, CONFIG.world.half + 44);
        let nz = clamp(p.z + mz, -CONFIG.world.half + 1, CONFIG.world.half + 1);
        const fixed = this.city.resolveCircle(nx, nz, CONFIG.player.radius);
        p.x = fixed.x;
        p.z = fixed.z;
        p.mesh.position.set(p.x, Math.abs(Math.sin(p.walkPhase)) * 0.05, p.z);
        p.mesh.rotation.y = p.heading;
        p.speed = Math.hypot(mx, mz) / dt;
      }

      // --- Enter / exit a car ---
      if (input.wasPressed('KeyE')) {
        if (p.inCar && p.car) {
          const car = p.car;
          // Step out on the driver's side.
          const side = { x: car.x - Math.cos(car.heading) * 1.8, z: car.z + Math.sin(car.heading) * 1.8 };
          const fixed = this.city.resolveCircle(side.x, side.z, CONFIG.player.radius);
          this.putOnFoot(fixed.x, fixed.z, car.heading);
          this.audio.click();
        } else {
          const car = this.nearestParkedCar();
          if (car) {
            this.putInCar(car);
            this.police.addWanted(CONFIG.wanted.stealCar);
            this.toast(`You took ${car.name}. The cops noticed.`);
            this.audio.pickup();
          }
        }
      }

      // --- Combat ---
      if (input.wasClicked(0)) this.combat.punch(this);
      if (input.wasClicked(2)) this.combat.shoot(this);

      // --- Pause / mute ---
      if (input.wasPressed('KeyP')) this.togglePause();
      if (input.wasPressed('KeyM')) {
        this.audio.setMuted(!this.audio.muted);
        this.toast(this.audio.muted ? 'Sound off.' : 'Sound on.');
      }
    }

    // --- The rest of the city, simulated while playing and not paused ---
    if (this.playing && !this.paused) {
      const allCars = [
        ...this.traffic.cars,
        ...this.police.cars,
        ...(p.inCar && p.car ? [p.car] : []),
      ];
      this.traffic.update(dt, p);
      this.pedestrians.update(dt, allCars);
      this.police.update(dt, p, this.elapsed);
      const done = this.missions.update(dt, this);
      if (done) {
        this.audio.chime();
        this.toast(`${done.title} complete — +$${done.reward}!`, 5);
        this.save();
      }
      this.combat.update(dt);
      this.missions.animateBeacon(this.elapsed);
      if (this.city.seaMat) {
        this.city.seaMat.opacity = 0.9 + Math.sin(this.elapsed * 0.5) * 0.04;
      }
      // Police rams hurt the player.
      p.ramCooldown = Math.max(0, p.ramCooldown - dt);
      for (const car of this.police.cars) {
        const d = dist2d(p.x, p.z, car.x, car.z);
        if (d < 3 && p.ramCooldown <= 0) {
          p.health -= 6;
          p.ramCooldown = 1;
          if (p.health <= 0) {
            p.health = 0;
            this.wasted = true;
            this.audio.busted();
            if (this.onWasted) this.onWasted();
          }
        }
      }
      if (this.police.busted && !this.busted) {
        this.busted = true;
        this.audio.busted();
        if (this.onBusted) this.onBusted();
      }
      // Engine hum and siren follow the action.
      this.audio.engine(p.inCar ? Math.abs(p.speed) / CONFIG.cars.maxSpeed : 0);
      let copNear = false;
      for (const car of this.police.cars) {
        if (dist2d(p.x, p.z, car.x, car.z) < 40) { copNear = true; break; }
      }
      this.audio.siren(copNear && this.police.wanted > 0);
      this.renderer.setFlash(this.combat.flashAt.x, this.combat.flashAt.z, this.combat.flashTimer > 0);
    }

    // --- HUD ---
    this.hud.setMoney(p.money);
    this.hud.setHealth(p.health);
    this.hud.setWanted(this.police.wanted);
    this.hud.setSpeed(p.inCar ? Math.abs(p.speed) * 3.6 : 0);
    this.hud.setObjective(this.missions.objectiveText());
    this.hud.drawMinimap({
      player: p,
      target: this.missions.targetPos(),
      walkers: this.pedestrians.dots(),
      traffic: this.traffic.dots(),
      police: this.police.dots(),
    });

    // Camera follows the player (or the player's car).
    this.renderer.follow(dt, p.x, p.z, p.heading, false);
    input.endFrame();
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      this.audio.engine(0);
      this.audio.siren(false);
    }
  }
}
