// Pedestrians for Vice Rush. Thirty walkers stroll the roads and the
// beach, turning at crossings, keeping the city feeling inhabited. A
// car that hits one earns a wanted star. The Night Market gang is a
// separate, stationary breed: five members who stand their ground until
// the player takes them out.

import * as THREE from 'three';
import { ROADS, CITY_HALF, GANG_SPAWNS } from './config.js';
import { rng } from './random.js';

const SHIRTS = [0xd94f4f, 0x4f9fd9, 0x7ac74f, 0xd9a441, 0x9b59b6, 0xe8e8e8, 0x2a2a2a, 0xe07840];
const SKINS = [0xe8b88a, 0xc98a5e, 0x8a5a3a, 0xf0c8a0];

function buildPersonMesh(shirt, skin, gang) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.95, 8), bodyMat);
  body.position.y = 0.85;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
  head.position.y = 1.55;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), legMat);
  legL.position.set(-0.14, 0.25, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legL, legR);
  if (gang) {
    // A red bandana and a darker jacket mark the gang.
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.56), new THREE.MeshLambertMaterial({ color: 0xaa1111 }));
    band.position.y = 1.68;
    g.add(band);
  }
  return g;
}

export class Pedestrians {
  constructor(scene, collide) {
    this.scene = scene;
    this.collide = collide;
    this.walkers = [];
    this.gang = [];
  }

  spawn(count) {
    for (let i = 0; i < count; i++) {
      this.addWalker();
    }
  }

  addWalker(x, z, heading) {
    const vertical = rng.chance(0.5);
    const road = rng.pick(ROADS);
    const along = rng.range(-CITY_HALF + 10, CITY_HALF - 10);
    const px = x !== undefined ? x : vertical ? road + rng.range(-4, 4) : along;
    const pz = z !== undefined ? z : vertical ? along : road + rng.range(-4, 4);
    const h = heading !== undefined ? heading : rng.range(0, Math.PI * 2);
    const w = {
      x: px, z: pz, heading: h, speed: rng.range(1.0, 2.0),
      mesh: buildPersonMesh(rng.pick(SHIRTS), rng.pick(SKINS), false),
      alive: true, fallTimer: 0,
    };
    w.mesh.position.set(px, 0, pz);
    w.mesh.rotation.y = h;
    this.walkers.push(w);
    this.scene.add(w.mesh);
    return w;
  }

  // The Night Market gang: five members standing on the roads around
  // the market, each on open ground, none inside a building.
  spawnGang() {
    this.clearGang();
    for (const s of GANG_SPAWNS) {
      const m = {
        x: s.x, z: s.z, heading: rng.range(0, Math.PI * 2),
        mesh: buildPersonMesh(0x5a1a1a, rng.pick(SKINS), true),
        alive: true, fallTimer: 0,
      };
      m.mesh.position.set(s.x, 0, s.z);
      m.mesh.rotation.y = m.heading;
      this.gang.push(m);
      this.scene.add(m.mesh);
    }
    return this.gang;
  }

  clearGang() {
    for (const m of this.gang) this.scene.remove(m.mesh);
    this.gang = [];
  }

  get gangAlive() {
    return this.gang.filter((m) => m.alive).length;
  }

  // Take a gang member out. Returns true if it was a live gang member.
  eliminate(person) {
    if (!person || !person.alive) return false;
    person.alive = false;
    person.fallTimer = 2.5;
    person.mesh.rotation.x = -Math.PI / 2;
    person.mesh.position.y = 0.3;
    return this.gang.includes(person);
  }

  // Mark a walker as down. The world or combat decides why.
  knockDown(w) {
    if (!w.alive) return;
    w.alive = false;
    w.fallTimer = 2.5;
    w.mesh.rotation.x = -Math.PI / 2;
    w.mesh.position.y = 0.3;
  }

  update(dt) {
    const toRespawn = [];
    for (const w of this.walkers) {
      if (!w.alive) {
        w.fallTimer -= dt;
        if (w.fallTimer <= 0) toRespawn.push(w);
        continue;
      }
      // Walk along the current heading; at a crossing, sometimes turn.
      const onCrossing = ROADS.some((c) => Math.abs(w.x - c) < 3 || Math.abs(w.z - c) < 3);
      if (onCrossing && rng.chance(dt * 0.2)) {
        w.heading += (rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
      }
      const nx = w.x + Math.sin(w.heading) * w.speed * dt;
      const nz = w.z + Math.cos(w.heading) * w.speed * dt;
      if (Math.abs(nx) < CITY_HALF && Math.abs(nz) < CITY_HALF && !this.collide(nx, nz, 0.5)) {
        w.x = nx;
        w.z = nz;
      } else {
        w.heading += Math.PI / 2;
      }
      w.mesh.position.set(w.x, 0, w.z);
      w.mesh.rotation.y = w.heading;
      // A little leg swing so they read as walking.
      const swing = Math.sin(performance.now() * 0.008 + w.x * 3) * 0.12;
      const legs = w.mesh.children.slice(2, 4);
      if (legs[0]) legs[0].position.z = swing;
      if (legs[1]) legs[1].position.z = -swing;
    }
    // Fallen walkers get back on their feet somewhere else in the city.
    for (const w of toRespawn) {
      const idx = this.walkers.indexOf(w);
      if (idx !== -1) this.walkers.splice(idx, 1);
      this.scene.remove(w.mesh);
      this.addWalker();
    }
    // Fallen gang members fade out after a couple of seconds.
    for (const m of this.gang) {
      if (!m.alive && m.fallTimer > 0) {
        m.fallTimer -= dt;
        if (m.fallTimer <= 0) this.scene.remove(m.mesh);
      }
    }
  }
}
