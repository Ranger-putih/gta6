// Sunset Bay, the city of Vice Rush. A 400 by 400 metre road grid, a
// beach and the sea along the east, a cafe on the sand, a garage in the
// south-west, and a night market at the (-160, 160) crossroads. Buildings
// are placed by a fixed seed, one per block, with a margin from the
// roads, so the same seed always builds the same city and every road
// stays open. Colliders are the truth the world drives against.

import * as THREE from 'three';
import { CITY_HALF, ROADS, ROAD_WIDTH, BEACH_CAFE, GARAGE, MARKET_STALLS } from './config.js';
import { fixedRng } from './random.js';

const BLOCK_EDGES = [-200, -160, -80, 0, 80, 160, 200];
const PALETTE = [0xd8c9a3, 0xc9b18c, 0xb7a6a0, 0x9fb4c7, 0xd9a441, 0xc96f4a, 0x8fa98f, 0xe0d5c1, 0x7d9bb5, 0xd98a7a];

export function circleHitsBox(x, z, r, b) {
  const cx = Math.max(b.minX, Math.min(x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

export function hitsCollider(colliders, x, z, r) {
  for (let i = 0; i < colliders.length; i++) {
    if (circleHitsBox(x, z, r, colliders[i])) return true;
  }
  return false;
}

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function flatBox(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
  m.position.set(x, y, z);
  return m;
}

export function buildCity(scene) {
  const colliders = [];
  const buildings = [];
  const rng = fixedRng(7);

  // Ground: grass, then sand on the eastern strip, then the sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 480),
    lambert(0x5d8a4a),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(20, 0, 0);
  scene.add(ground);

  const beach = new THREE.Mesh(new THREE.PlaneGeometry(42, 480), lambert(0xe0c98f));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(221, 0.02, 0);
  scene.add(beach);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, 480), lambert(0x2a6f9e));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(352, 0.01, 0);
  scene.add(sea);

  // Roads: dark asphalt ribbons, with a pale centre line each.
  const roadMat = lambert(0x2e2e33);
  const lineMat = lambert(0xd8d8c8);
  for (const r of ROADS) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, CITY_HALF * 2), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(r, 0.03, 0);
    scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, ROAD_WIDTH), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.03, r);
    scene.add(h);
    const lv = new THREE.Mesh(new THREE.PlaneGeometry(0.5, CITY_HALF * 2), lineMat);
    lv.rotation.x = -Math.PI / 2;
    lv.position.set(r, 0.04, 0);
    scene.add(lv);
    const lh = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, 0.5), lineMat);
    lh.rotation.x = -Math.PI / 2;
    lh.position.set(0, 0.04, r);
    scene.add(lh);
  }

  // Blocks: the squares between roads. The four blocks around the Night
  // Market crossroads grow stalls instead of buildings, so the market
  // and the garage delivery point stay open.
  const marketBlocks = new Set();
  for (const xi of [-200, -160]) {
    for (const zi of [80, 160]) marketBlocks.add(xi + ',' + zi);
  }
  for (let bi = 0; bi < BLOCK_EDGES.length - 1; bi++) {
    for (let bj = 0; bj < BLOCK_EDGES.length - 1; bj++) {
      const x0 = BLOCK_EDGES[bi];
      const z0 = BLOCK_EDGES[bj];
      if (marketBlocks.has(x0 + ',' + z0)) continue;
      const w = rng.range(14, 24);
      const d = rng.range(12, 20);
      const h = rng.range(8, 28);
      // The block runs x0..x0+80. Keep an 8-unit margin from each road,
      // so the centre can only roam the 64-w units between the margins.
      const cx = x0 + 8 + w / 2 + rng.range(0, Math.max(0, 64 - w));
      const cz = z0 + 8 + d / 2 + rng.range(0, Math.max(0, 64 - d));
      const color = rng.pick(PALETTE);
      const b = flatBox(w, h, d, color, cx, h / 2, cz);
      scene.add(b);
      // A flat roof cap in a lighter shade, so blocks read as buildings.
      scene.add(flatBox(w * 0.7, 0.6, d * 0.7, 0xe8e0d0, cx, h + 0.3, cz));
      const box = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
      colliders.push(box);
      buildings.push({ x: cx, z: cz, w, d, h, color });
    }
  }

  // The Beach Cafe, on the sand at (208, -40). The package marker sits
  // four metres north of its door, on open sand.
  const cafe = flatBox(BEACH_CAFE.w, 6, BEACH_CAFE.d, 0xe07840, BEACH_CAFE.x, 3, BEACH_CAFE.z);
  scene.add(cafe);
  const awning = flatBox(BEACH_CAFE.w + 2, 0.4, 4, 0xfff2d8, BEACH_CAFE.x, 4.4, BEACH_CAFE.z + 7);
  awning.rotation.x = 0.25;
  scene.add(awning);
  colliders.push({
    minX: BEACH_CAFE.x - BEACH_CAFE.w / 2, maxX: BEACH_CAFE.x + BEACH_CAFE.w / 2,
    minZ: BEACH_CAFE.z - BEACH_CAFE.d / 2, maxZ: BEACH_CAFE.z + BEACH_CAFE.d / 2,
  });
  buildings.push({ x: BEACH_CAFE.x, z: BEACH_CAFE.z, w: BEACH_CAFE.w, d: BEACH_CAFE.d, h: 6, color: 0xe07840 });

  // The garage in the south-west. Its delivery point sits south of it,
  // clear of its walls and of the market stalls.
  const garage = flatBox(GARAGE.w, 7, GARAGE.d, 0x5a6b7d, GARAGE.x, 3.5, GARAGE.z);
  scene.add(garage);
  scene.add(flatBox(GARAGE.w * 0.6, 0.5, 0.4, 0xffd400, GARAGE.x, 5, GARAGE.z - GARAGE.d / 2 - 0.2));
  colliders.push({
    minX: GARAGE.x - GARAGE.w / 2, maxX: GARAGE.x + GARAGE.w / 2,
    minZ: GARAGE.z - GARAGE.d / 2, maxZ: GARAGE.z + GARAGE.d / 2,
  });
  buildings.push({ x: GARAGE.x, z: GARAGE.z, w: GARAGE.w, d: GARAGE.d, h: 7, color: 0x5a6b7d });

  // Night Market stalls: small colourful boxes with awnings. They have
  // colliders, but they sit well clear of the market target and the
  // gang's standing spots.
  const stallColors = [0xd94f4f, 0x4f9fd9, 0x7ac74f, 0xd9a441, 0x9b59b6];
  MARKET_STALLS.forEach((s, i) => {
    scene.add(flatBox(3, 2.4, 3, stallColors[i % stallColors.length], s.x, 1.2, s.z));
    scene.add(flatBox(3.6, 0.3, 3.6, 0xfff2d8, s.x, 2.7, s.z));
    colliders.push({ minX: s.x - 1.5, maxX: s.x + 1.5, minZ: s.z - 1.5, maxZ: s.z + 1.5 });
    buildings.push({ x: s.x, z: s.z, w: 3, d: 3, h: 2.4, color: stallColors[i % stallColors.length] });
  });

  // Palm trees along the beach and a few on the main avenues.
  const palmRng = fixedRng(21);
  for (let z = -180; z <= 180; z += 28) {
    const x = 206 + palmRng.range(0, 26);
    addPalm(scene, x, z + palmRng.range(-6, 6), palmRng);
  }
  for (const [x, z] of [[-164, -120], [84, 120], [-84, -40], [164, 40], [4, -164], [-164, 40]]) {
    addPalm(scene, x, z, palmRng);
  }

  // Street lamps at a few crossings, for the night hours.
  for (const [x, z] of [[-160, -80], [0, 0], [80, 80], [-80, 160], [160, -160]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lambert(0x333333));
    pole.position.set(x + 7, 3, z + 7);
    scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lambert(0xfff2b0));
    lamp.position.set(x + 7, 6.1, z + 7);
    scene.add(lamp);
  }

  return { colliders, buildings };
}

function addPalm(scene, x, z, rng) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), lambert(0x8a6a4a));
  trunk.position.set(x, 3.5, z);
  trunk.rotation.z = rng.range(-0.08, 0.08);
  scene.add(trunk);
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 7), lambert(0x3d8a3d));
  leaves.position.set(x, 7.6, z);
  scene.add(leaves);
}
