// The Sunset Bay police. Wanted runs 0 to 5: cruisers chase and ram,
// officers on foot can bust the player, and at four stars a helicopter
// joins from the air with a spotlight. Wanted fades when the player
// stays clean and out of sight; every fresh crime pushes it back up.

import * as THREE from 'three';
import { Car } from './vehicles.js';
import { WANTED_MAX, WANTED_DECAY_SECONDS, ROADS, CITY_HALF } from './config.js';
import { rng } from './random.js';

function buildHeliMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x14213d });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8ef });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 5.2), dark);
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.2), glass);
  nose.position.set(0, 0.1, 2.8);
  g.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), dark);
  tail.position.set(0, 0.3, -4.2);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 1.0), dark);
  fin.position.set(0, 1.0, -6.0);
  g.add(fin);
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), bladeMat);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 11), bladeMat);
  rotor.add(b1, b2);
  rotor.position.y = 1.1;
  g.add(rotor);
  g.userData.rotor = rotor;
  // A visible spotlight cone under the helicopter.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide,
    depthWrite: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 34, 16, 1, true), coneMat);
  cone.position.y = -17;
  cone.rotation.x = Math.PI;
  g.add(cone);
  const light = new THREE.SpotLight(0xfff2b0, 60, 60, 0.35, 0.5, 1.2);
  light.position.set(0, -1, 0);
  light.target.position.set(0, -34, 0);
  g.add(light);
  g.add(light.target);
  return g;
}

function buildOfficerMesh() {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x14213d });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.0, 8), navy);
  body.position.y = 0.9;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.6;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), navy);
  cap.position.y = 1.82;
  g.add(cap);
  return g;
}

export class Police {
  constructor(scene, collide) {
    this.scene = scene;
    this.collide = collide;
    this.wanted = 0;
    this.cars = [];
    this.officers = [];
    this.heli = null;
    this.heliMesh = null;
    this.decayTimer = 0;
    this.bustTimer = 0;
    this.spawnTimer = 0;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(WANTED_MAX, n));
    this.decayTimer = 0;
  }

  addWanted(n) {
    this.setWanted(this.wanted + n);
  }

  // Stage a cruiser somewhere for the chase screenshot.
  spawnAt(x, z, heading) {
    const car = new Car('police', x, z, heading);
    car.speed = 12;
    this.cars.push(car);
    this.scene.add(car.mesh);
    return car;
  }

  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    if (this.heliMesh) this.scene.remove(this.heliMesh);
    this.cars = [];
    this.officers = [];
    this.heli = null;
    this.heliMesh = null;
    this.wanted = 0;
    this.bustTimer = 0;
  }

  update(dt, player, onBusted) {
    if (this.wanted <= 0) {
      this.clear();
      return;
    }

    // Wanted fades after a quiet stretch.
    this.decayTimer += dt;
    if (this.decayTimer > WANTED_DECAY_SECONDS) {
      this.setWanted(this.wanted - 1);
      this.decayTimer = 0;
    }

    // Keep the right number of cruisers on the road.
    this.spawnTimer -= dt;
    const wantCars = Math.min(this.wanted, 5);
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      const road = rng.pick(ROADS);
      const vertical = rng.chance(0.5);
      const along = rng.range(-140, 140);
      const x = vertical ? road : along + (player.x > 0 ? -60 : 60);
      const z = vertical ? along + (player.z > 0 ? -60 : 60) : road;
      const car = new Car('police', x, z, 0);
      car.speed = 10;
      this.cars.push(car);
      this.scene.add(car.mesh);
    }
    // Foot officers appear from two stars up.
    const wantOfficers = this.wanted >= 2 ? Math.min(this.wanted - 1, 3) : 0;
    if (this.officers.length < wantOfficers && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      const mesh = buildOfficerMesh();
      const o = {
        x: player.x + rng.range(-25, 25), z: player.z + rng.range(-25, 25),
        heading: 0, speed: 3.2, mesh, alive: true,
      };
      mesh.position.set(o.x, 0, o.z);
      this.officers.push(o);
      this.scene.add(mesh);
    }

    // Cruisers chase: steer toward the player and ram at close range.
    for (const car of this.cars) {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-1, Math.min(1, diff * 2)) * 1.6 * dt;
      const targetSpeed = dist > 60 ? 34 : dist > 12 ? 26 : 14;
      car.speed += (targetSpeed - car.speed) * dt * 0.8;
      const nx = car.x + car.forwardX * car.speed * dt;
      const nz = car.z + car.forwardZ * car.speed * dt;
      if (!this.collide(nx, nz, 1.4)) {
        car.x = nx;
        car.z = nz;
      } else {
        car.heading += 0.8 * dt;
        car.speed *= 0.8;
      }
      car.syncMesh();
      // A ram dents the player's car and shoves it along.
      if (player.car && dist < 3.4) {
        player.car.damage(6 * dt);
        const push = 3.0 * dt;
        player.car.x += car.forwardX * push;
        player.car.z += car.forwardZ * push;
        player.car.syncMesh();
      }
    }

    // Officers walk at the player; close on foot for two seconds busts.
    let nearestOfficer = Infinity;
    for (const o of this.officers) {
      if (!o.alive) continue;
      const dx = player.x - o.x;
      const dz = player.z - o.z;
      const dist = Math.hypot(dx, dz) || 1;
      nearestOfficer = Math.min(nearestOfficer, dist);
      o.heading = Math.atan2(dx, dz);
      o.x += Math.sin(o.heading) * o.speed * dt;
      o.z += Math.cos(o.heading) * o.speed * dt;
      o.mesh.position.set(o.x, 0, o.z);
      o.mesh.rotation.y = o.heading;
    }
    if (!player.car && nearestOfficer < 2.5) {
      this.bustTimer += dt;
      if (this.bustTimer > 2 && onBusted) onBusted();
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }

    // The helicopter: four stars and up, it hovers over the player with
    // a spotlight. It never shoots — it is the sky reminding you to run.
    if (this.wanted >= 4 && !this.heliMesh) {
      this.heliMesh = buildHeliMesh();
      this.heliMesh.position.set(player.x, 38, player.z);
      this.scene.add(this.heliMesh);
      this.heli = { x: player.x, z: player.z };
    } else if (this.wanted < 4 && this.heliMesh) {
      this.scene.remove(this.heliMesh);
      this.heliMesh = null;
      this.heli = null;
    }
    if (this.heliMesh) {
      const tx = player.x + 6;
      const tz = player.z - 4;
      this.heli.x += (tx - this.heli.x) * Math.min(1, dt * 0.8);
      this.heli.z += (tz - this.heli.z) * Math.min(1, dt * 0.8);
      this.heliMesh.position.set(this.heli.x, 38 + Math.sin(performance.now() * 0.001) * 1.2, this.heli.z);
      this.heliMesh.rotation.y += dt * 0.4;
      this.heliMesh.userData.rotor.rotation.y += dt * 18;
    }

    // Prune cruisers that fell far behind the action.
    this.cars = this.cars.filter((c) => {
      const d = Math.hypot(c.x - player.x, c.z - player.z);
      if (d > 320) {
        this.scene.remove(c.mesh);
        return false;
      }
      return true;
    });
  }
}
