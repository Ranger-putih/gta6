// Pedestrians and the Night Market crew. Walkers wander the sidewalks;
// crew members stand their ground at the market and shoot back during M5.

import * as THREE from 'three';
import { WORLD, PEDESTRIAN_COUNT, GANG_SPOTS } from './config.js';
import { Rng } from './random.js';

const SHIRT_COLORS = [0xd8a017, 0x3f6fb5, 0x8a4a6a, 0x4a8a5a, 0xd8d8d8, 0x6a4a8a, 0xb05a2a, 0x2a8a8a];
const SKIN_COLORS = [0xe8b88a, 0xc88a5a, 0x8a5a3a, 0xf0c8a0];

function makePersonMesh(shirt, skin, gang = false) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 1.05, 8),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 0.85;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.62;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.6, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2a2d33 }),
  );
  legs.position.y = 0.3;
  group.add(legs);
  if (gang) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.12, 0.58),
      new THREE.MeshLambertMaterial({ color: 0xd83a2e }),
    );
    band.position.y = 1.78;
    group.add(band);
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1a1d22 }),
    );
    gun.position.set(0.35, 1.0, 0.2);
    group.add(gun);
  }
  return group;
}

export class Pedestrians {
  constructor(scene, rngSeed = 31) {
    const rng = new Rng(rngSeed);
    this.group = new THREE.Group();
    this.group.name = 'pedestrians';
    scene.add(this.group);
    this.walkers = [];
    this.crew = [];
    for (let i = 0; i < PEDESTRIAN_COUNT; i++) {
      const p = this._spawnWalker(rng, false);
      this.walkers.push(p);
    }
    for (const spot of GANG_SPOTS) {
      const mesh = makePersonMesh(0x2a2d33, rng.pick(SKIN_COLORS), true);
      mesh.position.set(spot.x, 0, spot.z);
      this.group.add(mesh);
      this.crew.push({
        mesh, x: spot.x, z: spot.z, heading: rng.range(0, Math.PI * 2),
        hp: 100, alive: true, kind: 'gang', shootCd: rng.range(1, 3),
      });
    }
  }

  _spawnWalker(rng, anywhere) {
    const road = rng.pick(WORLD.roadCoords);
    const along = rng.range(-185, 185);
    const side = rng.chance(0.5) ? 8.5 : -8.5;
    const onXRoad = rng.chance(0.5);
    const x = onXRoad ? along : road + side;
    const z = onXRoad ? road + side : along;
    const mesh = makePersonMesh(rng.pick(SHIRT_COLORS), rng.pick(SKIN_COLORS));
    mesh.position.set(x, 0, z);
    this.group.add(mesh);
    return {
      mesh, x, z, heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.4, 2.6), hp: 100, alive: true, kind: 'walker',
      tx: x, tz: z, retarget: rng.range(2, 8),
    };
  }

  update(dt, player, colliders, gangActive, onDamage) {
    for (const w of this.walkers) {
      if (!w.alive) continue;
      w.retarget -= dt;
      if (w.retarget <= 0) {
        w.retarget = 4 + Math.random() * 6;
        // Pick a new sidewalk point near a random road.
        const road = WORLD.roadCoords[Math.floor(Math.random() * WORLD.roadCoords.length)];
        const along = Math.max(-185, Math.min(185, (Math.random() < 0.5 ? w.x : w.z) + (Math.random() - 0.5) * 120));
        const side = Math.random() < 0.5 ? 8.5 : -8.5;
        if (Math.random() < 0.5) { w.tx = along; w.tz = road + side; }
        else { w.tx = road + side; w.tz = along; }
      }
      const dx = w.tx - w.x;
      const dz = w.tz - w.z;
      const d = Math.hypot(dx, dz);
      if (d > 1) {
        const want = Math.atan2(dx, dz);
        let dh = want - w.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        w.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
        w.x += Math.sin(w.heading) * w.speed * dt;
        w.z += Math.cos(w.heading) * w.speed * dt;
        w.x = Math.max(-196, Math.min(196, w.x));
        w.z = Math.max(-196, Math.min(196, w.z));
      }
      w.mesh.position.set(w.x, 0, w.z);
      w.mesh.rotation.y = w.heading;
    }
    // Crew: stand near their post, turn to face the player, shoot back
    // while the M5 eliminate stage is live.
    for (const c of this.crew) {
      if (!c.alive) continue;
      const dx = player.x - c.x;
      const dz = player.z - c.z;
      const d = Math.hypot(dx, dz);
      c.heading = Math.atan2(dx, dz);
      c.mesh.rotation.y = c.heading;
      if (gangActive && d < 30) {
        c.shootCd -= dt;
        if (c.shootCd <= 0) {
          c.shootCd = 2.4 + Math.random() * 1.4;
          // Gang fire is suppressive, not lethal: low hit chance, small
          // damage, and worse aim against a moving car.
          const hitChance = player.car ? 0.22 : 0.35;
          if (Math.random() < hitChance && onDamage) {
            onDamage(3 + Math.random() * 2, 'shot');
          }
        }
      }
    }
  }

  aliveCrew() {
    return this.crew.filter((c) => c.alive);
  }

  crewLeft() {
    return this.crew.filter((c) => c.alive).length;
  }

  // Damage the nearest living person within range of a shot ray.
  // origin: {x,y,z}, dir: normalised {x,y,z}. Returns the person hit or null.
  rayHit(origin, dir, maxDist = 45) {
    let best = null;
    let bestD = maxDist;
    const all = [...this.walkers, ...this.crew];
    for (const p of all) {
      if (!p.alive) continue;
      const cx = p.x - origin.x;
      const cy = 1.2 - origin.y;
      const cz = p.z - origin.z;
      const along = cx * dir.x + cy * dir.y + cz * dir.z;
      if (along < 0 || along > bestD) continue;
      const px = cx - dir.x * along;
      const py = cy - dir.y * along;
      const pz = cz - dir.z * along;
      const miss = Math.sqrt(px * px + py * py + pz * pz);
      if (miss < 1.3) {
        best = p;
        bestD = along;
      }
    }
    return best;
  }

  kill(p) {
    p.alive = false;
    p.mesh.visible = false;
  }

  positions() {
    return this.walkers.filter((w) => w.alive).map((w) => ({ x: w.x, z: w.z }));
  }
}
