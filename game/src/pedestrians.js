// Pedestrians: people walking the sidewalks. Each one strolls along a
// sidewalk edge, turns around at the end of a block, and wanders to the next
// block now and then. They are simple capsule figures in bright clothes, and
// they scatter (run away from) a car that comes at them fast.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { range, pick, dist2d } from './random.js';

const SHIRTS = [0xd95f4b, 0x4b7fd9, 0x5fb84b, 0xd9b84b, 0x9b4bd9, 0x4bd9c9, 0xe8e8e8, 0x2e2e2e];
const PANTS = [0x2e3a4a, 0x4a2e2e, 0x3a4a2e, 0x2e2e2e];

export class Pedestrians {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.walkers = [];
    const roads = CONFIG.world.roads;
    for (let i = 0; i < CONFIG.pedestrians.count; i += 1) {
      // Pick a sidewalk: just off a road, on a block edge.
      const road = pick(rng, roads);
      const alongX = rng() < 0.5;
      const side = rng() < 0.5 ? -1 : 1;
      const t = range(rng, -170, 170);
      const x = alongX ? t : road + side * 8;
      const z = alongX ? road + side * 8 : t;
      const mesh = this.makeWalkerMesh();
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.walkers.push({
        mesh, x, z,
        heading: alongX ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
        speed: range(rng, 1.2, CONFIG.pedestrians.walkSpeed),
        alongX,
        road,
        side,
        // A walker that was hit staggers and then falls.
        health: CONFIG.combat.pedHealth,
        down: false,
        downTimer: 0,
        flee: 0,
        // Walk-cycle phase, advanced by dt so the bob is deterministic.
        phase: range(rng, 0, Math.PI * 2),
      });
    }
  }

  makeWalkerMesh() {
    const group = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: pick(this.rng, SHIRTS), roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: pick(this.rng, PANTS), roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.85, 8), shirt);
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), skin);
    head.position.y = 1.62;
    head.castShadow = true;
    group.add(head);
    for (const sx of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 6), pants);
      leg.position.set(sx, 0.28, 0);
      group.add(leg);
    }
    return group;
  }

  update(dt, cars) {
    for (const w of this.walkers) {
      if (w.down) {
        w.downTimer -= dt;
        // Lie flat for a while, then get back up and walk on.
        w.mesh.rotation.x = -Math.PI / 2 + Math.min(1, (3 - w.downTimer) / 3) * 0;
        w.mesh.position.y = 0.3;
        if (w.downTimer <= 0) {
          w.down = false;
          w.health = CONFIG.combat.pedHealth;
          w.mesh.rotation.x = 0;
          w.mesh.position.y = 0;
        }
        continue;
      }
      // Flee a fast car that is close: run away from it.
      let speed = w.speed;
      if (cars) {
        for (const c of cars) {
          const d = dist2d(w.x, w.z, c.x, c.z);
          if (d < 7 && Math.abs(c.speed) > 8) {
            w.flee = 1.2;
            w.heading = Math.atan2(w.x - c.x, w.z - c.z);
          }
        }
      }
      if (w.flee > 0) {
        w.flee -= dt;
        speed = w.speed * 2.6;
      }
      // Stroll along the sidewalk; turn at the block's end.
      const fx = Math.sin(w.heading);
      const fz = Math.cos(w.heading);
      w.x += fx * speed * dt;
      w.z += fz * speed * dt;
      const pos = w.alongX ? w.x : w.z;
      if (pos > 185 || pos < -185) {
        w.heading += Math.PI;
        w.x = Math.max(-185, Math.min(185, w.x));
        w.z = Math.max(-185, Math.min(185, w.z));
      }
      // A small chance to turn onto a crossing sidewalk.
      if (this.rng() < dt * 0.05) {
        const roads = CONFIG.world.roads;
        const cross = w.alongX ? w.z : w.x;
        let nearest = roads[0];
        for (const r of roads) {
          if (Math.abs(r - cross) < Math.abs(nearest - cross)) nearest = r;
        }
        if (Math.abs(cross - nearest) < 10) {
          if (w.alongX) {
            w.z = nearest + w.side * 8;
            w.alongX = false;
            w.heading = this.rng() < 0.5 ? 0 : Math.PI;
          } else {
            w.x = nearest + w.side * 8;
            w.alongX = true;
            w.heading = this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
      }
      w.mesh.position.set(w.x, 0, w.z);
      w.mesh.rotation.y = w.heading;
      // A simple walk bob, driven by the walk phase so it is deterministic.
      w.phase += dt * speed * 2.2;
      w.mesh.position.y = Math.abs(Math.sin(w.phase)) * 0.04;
    }
  }

  // Hurt a walker at (x, z) within `radius`; returns the walker hit, if any.
  hurtAt(x, z, radius, damage) {
    for (const w of this.walkers) {
      if (w.down) continue;
      if (dist2d(w.x, w.z, x, z) < radius) {
        w.health -= damage;
        if (w.health <= 0) {
          w.down = true;
          w.downTimer = 3;
        }
        return w;
      }
    }
    return null;
  }

  dots() {
    return this.walkers.filter((w) => !w.down).map((w) => ({ x: w.x, z: w.z }));
  }
}
