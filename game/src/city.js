// Sunset Bay: the city itself. A 400x400 m grid town with a beach and sea
// to the east, six named districts, a night market, a pier and two open
// plazas. Buildings live strictly inside their blocks (6 m clear of every
// road edge) so no building ever blocks a street — the M4 race line on the
// x=160 road stays open.

import * as THREE from 'three';
import { WORLD, districtAt } from './config.js';
import { Rng } from './random.js';

const BLOCK_CENTERS = [-120, -40, 40, 120];
// Open plazas: no buildings here, only trees — coins and mission targets
// inside these blocks are always reachable.
const PLAZA_BLOCKS = ['40,40', '120,-40'];
const BUILDING_COLORS = [0x8a7f72, 0x6f7f8a, 0x9a8a6a, 0x7a6f8a, 0x5f7080, 0xa08a7a, 0x6a7a6a, 0x8a6a5a];
const AWNING_COLORS = [0xd84a4a, 0x3f8a4a, 0x3f6fb5, 0xd8a017, 0x8a4ad8];

export function circleHitsBox(x, z, r, box) {
  const cx = Math.max(box.minX, Math.min(x, box.maxX));
  const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

export function hitsCollider(x, z, r, colliders) {
  for (const box of colliders) {
    if (circleHitsBox(x, z, r, box)) return box;
  }
  return null;
}

export function pushOutOfColliders(pos, r, colliders) {
  for (const box of colliders) {
    if (!circleHitsBox(pos.x, pos.z, r, box)) continue;
    const cx = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const cz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
    let dx = pos.x - cx;
    let dz = pos.z - cz;
    let d = Math.hypot(dx, dz);
    if (d < 0.001) {
      // Centre is inside the box: push out along the smallest penetration.
      const pl = Math.min(pos.x - box.minX, box.maxX - pos.x);
      const pz = Math.min(pos.z - box.minZ, box.maxZ - pos.z);
      if (pl < pz) pos.x = pos.x - box.minX < box.maxX - pos.x ? box.minX - r : box.maxX + r;
      else pos.z = pos.z - box.minZ < box.maxZ - pos.z ? box.minZ - r : box.maxZ + r;
      continue;
    }
    dx /= d;
    dz /= d;
    pos.x = cx + dx * r;
    pos.z = cz + dz * r;
  }
}

function groundTexture() {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  const px = (m) => ((m + 200) / 400) * S;
  // City blocks.
  g.fillStyle = '#3a3e45';
  g.fillRect(0, 0, S, S);
  // Beach sand on the east strip.
  g.fillStyle = '#c9a86a';
  g.fillRect(px(166), 0, S - px(166), S);
  // Roads: dark strips with a dashed centre line.
  for (const c of WORLD.roadCoords) {
    g.fillStyle = '#22252a';
    g.fillRect(px(c - 6), 0, px(12) - px(0), S);
    g.fillRect(0, px(c - 6), S, px(12) - px(0));
    g.fillStyle = '#c8c8a8';
    for (let m = -196; m < 200; m += 16) {
      g.fillRect(px(m), px(c - 0.6), px(6) - px(0), px(1.2) - px(0));
      g.fillRect(px(c - 0.6), px(m), px(1.2) - px(0), px(6) - px(0));
    }
  }
  // Sidewalk tint around each block.
  g.strokeStyle = '#4a4e55';
  g.lineWidth = 3;
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      g.strokeRect(px(bx - 34), px(bz - 34), px(68) - px(0), px(68) - px(0));
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildCity(scene) {
  const rng = new Rng(20261122);
  const colliders = [];
  const lampMats = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // Ground with painted roads, plus sand and sea planes to the east.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 400),
    new THREE.MeshLambertMaterial({ color: 0xc9a86a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(183, 0.02, 0);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 400),
    new THREE.MeshLambertMaterial({ color: 0x1e5f8a }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(226, 0.01, 0);
  group.add(sea);

  // Buildings: one to three per block, kept 6 m inside the block so roads
  // stay clear. Downtown blocks get the tallest towers.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 0.6, 1);
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      if (PLAZA_BLOCKS.includes(`${bx},${bz}`)) continue;
      const downtown = Math.abs(bx) <= 40 && Math.abs(bz) <= 40;
      const count = downtown ? rng.int(2, 3) : rng.int(1, 2);
      const slots = downtown
        ? [[-16, -16], [16, -16], [-16, 16], [16, 16], [0, 0]]
        : [[-14, -14], [14, 14], [-14, 14], [14, -14]];
      for (let i = 0; i < count; i++) {
        const [ox, oz] = slots[i % slots.length];
        const w = rng.range(13, 22);
        const d = rng.range(13, 22);
        const h = downtown ? rng.range(16, 34) : rng.range(8, 20);
        const color = rng.pick(BUILDING_COLORS);
        const mat = new THREE.MeshLambertMaterial({ color });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(bx + ox, h / 2, bz + oz);
        group.add(b);
        const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x2c2f36 }));
        roof.scale.set(w * 0.9, 1, d * 0.9);
        roof.position.set(bx + ox, h + 0.3, bz + oz);
        group.add(roof);
        // Lit windows on some towers: a thin emissive band near the top.
        if (rng.chance(0.5)) {
          const band = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.96, 0.7, d * 0.96),
            new THREE.MeshBasicMaterial({ color: 0xffc861 }),
          );
          band.position.set(bx + ox, h * 0.72, bz + oz);
          band.name = 'windowBand';
          group.add(band);
        }
        colliders.push({
          minX: bx + ox - w / 2, maxX: bx + ox + w / 2,
          minZ: bz + oz - d / 2, maxZ: bz + oz + d / 2,
        });
      }
    }
  }

  // Street lamps along every road, glowing at night.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.5, 6);
  const lampGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  for (const c of WORLD.roadCoords) {
    for (let m = -160; m <= 160; m += 80) {
      for (const [lx, lz] of [[c + 7, m], [m, c + 7]]) {
        if (lx > 166 || lz > 166) continue;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(lx, 2.75, lz);
        group.add(pole);
        const lm = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
        lampMats.push(lm);
        const lamp = new THREE.Mesh(lampGeo, lm);
        lamp.position.set(lx, 5.6, lz);
        group.add(lamp);
      }
    }
  }

  // Palm trees on the beach, kept clear of coins, the cafe and the pier.
  const keepClear = [[176, -40], [172, 96], [172, -120], [176, -8], [182, -120]];
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
  const topGeo = new THREE.SphereGeometry(2.2, 8, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const topMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
  for (let i = 0; i < 26; i++) {
    const x = rng.range(170, 193);
    const z = rng.range(-185, 185);
    if (keepClear.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < 9)) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3, z);
    group.add(trunk);
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(x, 6.6, z);
    top.scale.y = 0.7;
    group.add(top);
  }

  // Plaza trees (Downtown Plaza + Sunset Park): ring the edges, centres open.
  for (const [px, pz] of [[40, 40], [120, -40]]) {
    for (const [ox, oz] of [[-26, -26], [26, -26], [-26, 26], [26, 26], [0, -26], [-26, 0]]) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(px + ox, 2.4, pz + oz);
      trunk.scale.y = 0.8;
      group.add(trunk);
      const top = new THREE.Mesh(topGeo, new THREE.MeshLambertMaterial({ color: 0x3f8a4a }));
      top.position.set(px + ox, 5.4, pz + oz);
      top.scale.y = 0.75;
      group.add(top);
    }
  }

  // Night Market stalls: two rows inside the block by the (-160,160)
  // intersection. The target point itself stays open.
  const stallSpots = [
    [-150, 140], [-140, 140], [-130, 140],
    [-150, 128], [-140, 128], [-130, 128],
  ];
  const counterGeo = new THREE.BoxGeometry(4, 1.6, 2);
  const awningGeo = new THREE.BoxGeometry(4.6, 0.25, 2.8);
  stallSpots.forEach(([sx, sz], i) => {
    const counter = new THREE.Mesh(counterGeo, new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
    counter.position.set(sx, 0.8, sz);
    group.add(counter);
    const awning = new THREE.Mesh(
      awningGeo,
      new THREE.MeshLambertMaterial({ color: AWNING_COLORS[i % AWNING_COLORS.length] }),
    );
    awning.position.set(sx, 2.6, sz);
    group.add(awning);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd27a }),
    );
    bulb.position.set(sx, 2.2, sz + 1.2);
    bulb.name = 'stallBulb';
    group.add(bulb);
    colliders.push({ minX: sx - 2, maxX: sx + 2, minZ: sz - 1, maxZ: sz + 1 });
  });

  // Beach Cafe: a low open-front shack on the sand at (176,-8).
  const cafe = new THREE.Mesh(
    new THREE.BoxGeometry(10, 4, 7),
    new THREE.MeshLambertMaterial({ color: 0xd8c8a8 }),
  );
  cafe.position.set(182, 2, -8);
  group.add(cafe);
  const cafeRoof = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.4, 8),
    new THREE.MeshLambertMaterial({ color: 0xb03a2e }),
  );
  cafeRoof.position.set(182, 4.2, -8);
  group.add(cafeRoof);
  colliders.push({ minX: 177, maxX: 187, minZ: -11.5, maxZ: -4.5 });

  // Garage canopy on the west strip: roof on posts, no collider — the
  // deliver point under it stays drivable.
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.5, 10),
    new THREE.MeshLambertMaterial({ color: 0x4a5a6a }),
  );
  canopy.position.set(-180, 4.5, 152);
  group.add(canopy);
  for (const [ox, oz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 4.5, 6), poleMat);
    post.position.set(-180 + ox, 2.25, 152 + oz);
    group.add(post);
  }

  // Wooden pier reaching into the sea at the north beach.
  for (let x = 168; x <= 194; x += 4) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.3, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
    );
    plank.position.set(x, 0.35, -120);
    group.add(plank);
  }

  function setNight(factor) {
    // factor 0 = day, 1 = full night: lamps and stall bulbs glow.
    for (const m of lampMats) m.color.setHex(factor > 0.4 ? 0xffe9a8 : 0x8a8a7a);
  }

  return { colliders, setNight, districtAt };
}
