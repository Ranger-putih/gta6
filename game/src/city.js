// The city of Sunset Bay: a road grid by the sea, built from boxes with
// lit-window textures, palms, lamps and a sunset sky. It also owns the
// collision boxes (colliders) the player, cars and pedestrians resolve
// against, and the named spots the missions use.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

/** One lit-window texture, drawn on a canvas (no image files are loaded). */
function windowTexture(rng, litChance) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#2c3550';
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = rng.next() < litChance;
      g.fillStyle = lit ? '#ffd27a' : '#1d2438';
      g.fillRect(8 + col * 20, 10 + row * 20, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, material) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material || new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Push a circle (x, z, radius) out of every axis-aligned box it overlaps. */
export function collideCircle(pos, radius, colliders) {
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.000001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      // Centre inside the box: push out along the smallest overlap.
      const pushLeft = pos.x - c.minX + radius;
      const pushRight = c.maxX - pos.x + radius;
      const pushUp = pos.z - c.minZ + radius;
      const pushDown = c.maxZ - pos.z + radius;
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) pos.x = c.minX - radius;
      else if (min === pushRight) pos.x = c.maxX + radius;
      else if (min === pushUp) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  const textures = [windowTexture(rng, 0.55), windowTexture(rng, 0.4), windowTexture(rng, 0.7)];

  // Ground: one big slab, then the sand strip and the sea on top of it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(780, 640),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(70, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(38, 640),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(219, 0.02, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(222, 640),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(349, 0.01, 0);
  group.add(sea);

  // Roads: dark strips along every grid line, plus the coastal road.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const roadCentres = [...CITY.roads];
  roadCentres.forEach((c) => {
    const alongX = new THREE.Mesh(new THREE.PlaneGeometry(400, CITY.road), roadMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.position.set(0, 0.03, c);
    alongX.receiveShadow = true;
    group.add(alongX);
    const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, 400), roadMat);
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.position.set(c, 0.03, 0);
    alongZ.receiveShadow = true;
    group.add(alongZ);
  });
  const coastal = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, 400), roadMat);
  coastal.rotation.x = -Math.PI / 2;
  coastal.position.set(192, 0.03, 0);
  coastal.receiveShadow = true;
  group.add(coastal);

  // Lane dashes, as one instanced mesh.
  const dashGeo = new THREE.BoxGeometry(3, 0.06, 0.5);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
  const dashPositions = [];
  roadCentres.forEach((c) => {
    for (let t = -190; t <= 190; t += 12) {
      dashPositions.push({ x: t, z: c, rotY: 0 });
      dashPositions.push({ x: c, z: t, rotY: Math.PI / 2 });
    }
  });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashPositions.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3(1, 1, 1);
  dashPositions.forEach((d, i) => {
    quat.setFromAxisAngle(up, d.rotY);
    matrix.compose(new THREE.Vector3(d.x, 0.06, d.z), quat, scale);
    dashes.setMatrixAt(i, matrix);
  });
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  // Buildings: one to three per block, heights and colours from the seed.
  const blockCentres = [-120, -40, 40, 120];
  blockCentres.forEach((bx) => {
    blockCentres.forEach((bz) => {
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(18, 30);
        const d = rng.range(18, 30);
        const h = rng.range(12, 55);
        const x = bx + rng.range(-14, 14);
        const z = bz + rng.range(-14, 14);
        const tex = rng.pick(textures);
        const mat = new THREE.MeshLambertMaterial({
          color: rng.pick(PALETTE.building),
          map: tex,
          emissive: 0xff9a3c,
          emissiveMap: tex,
          emissiveIntensity: 0.35,
        });
        const building = box(w, h, d, 0xffffff, x, h / 2, z, mat);
        group.add(building);
        // Rooftop box.
        group.add(box(w * 0.3, 2.5, d * 0.3, 0x5a5f6a, x + w * 0.2, h + 1.2, z - d * 0.15));
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    });
  });

  // The Beach Cafe (mission 1) and the garage (mission 2): named buildings.
  const cafe = box(16, 7, 12, 0xf6e3c5, 208, 3.5, -40);
  group.add(cafe);
  group.add(box(17, 1.2, 13, 0xe07856, 208, 7.6, -40));
  colliders.push({ minX: 200, maxX: 216, minZ: -46, maxZ: -34 });
  const garage = box(18, 8, 14, 0x9fb8c8, -168, 4, 168);
  group.add(garage);
  group.add(box(19, 1, 15, 0x2e323d, -168, 8.5, 168));
  colliders.push({ minX: -177, maxX: -159, minZ: 161, maxZ: 175 });

  // Palms along the beach and a few in the blocks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.trunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palm });
  function palm(x, z) {
    const palmGroup = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 6), trunkMat);
    trunk.position.y = 4.5;
    trunk.castShadow = true;
    palmGroup.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.25, 1.4), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 2.2, 9.2, Math.sin(a) * 2.2);
      leaf.rotation.y = -a;
      leaf.rotation.z = 0.35;
      leaf.castShadow = true;
      palmGroup.add(leaf);
    }
    palmGroup.position.set(x, 0, z);
    return palmGroup;
  }
  for (let z = -180; z <= 180; z += 36) {
    group.add(palm(204 + rng.range(-2, 2), z + rng.range(-4, 4)));
    group.add(palm(232 + rng.range(-2, 2), z + rng.range(-6, 6)));
  }
  for (let i = 0; i < 10; i += 1) {
    group.add(palm(rng.range(-180, 180), rng.range(-180, 180)));
  }

  // Street lamps at intersections.
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: PALETTE.lamp });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c414d });
  [-160, -80, 0, 80, 160].forEach((c) => {
    [-160, 0, 160].forEach((d) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 6), poleMat);
      pole.position.set(c + 9, 3.5, d + 9);
      pole.castShadow = true;
      group.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.8), lampHeadMat);
      head.position.set(c + 9, 7.1, d + 9);
      group.add(head);
    });
  });

  // Sunset sun disc and a few clouds.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  sun.position.set(330, 95, -260);
  sun.lookAt(0, 20, 0);
  group.add(sun);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false });
  for (let i = 0; i < 7; i += 1) {
    const cloud = new THREE.Mesh(new THREE.BoxGeometry(rng.range(30, 70), 3, rng.range(10, 18)), cloudMat);
    cloud.position.set(rng.range(-260, 260), rng.range(90, 140), rng.range(-280, 60));
    group.add(cloud);
  }

  // The sea is a wall: nothing walks or drives into it. Same for the map edge.
  colliders.push({ minX: CITY.seaX, maxX: 460, minZ: -320, maxZ: 320 });
  colliders.push({ minX: -320, maxX: -300, minZ: -320, maxZ: 320 });
  colliders.push({ minX: -320, maxX: 460, minZ: -320, maxZ: -300 });
  colliders.push({ minX: -320, maxX: 460, minZ: 300, maxZ: 320 });

  scene.add(group);
  return {
    colliders,
    sea,
    /** True when the point is on a road (used by traffic lanes). */
    isOnRoad(x, z) {
      return CITY.roads.some((c) => Math.abs(x - c) < CITY.road / 2) ||
        CITY.roads.some((c) => Math.abs(z - c) < CITY.road / 2) ||
        Math.abs(x - 192) < CITY.road / 2;
    },
    update(time) {
      sea.position.y = 0.01 + Math.sin(time * 0.5) * 0.15;
    },
  };
}
