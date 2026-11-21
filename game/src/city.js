// The city of Sunset Bay: ground, road grid, blocks, buildings, the beach
// and the sea, the Beach Cafe and the garage, palms and street lamps.
// Everything is built once from the seeded rng, so the same seed always
// builds the same city. Buildings also register axis-aligned colliders that
// the player, the cars, the traffic and the police all respect.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { range, rangeInt, pick } from './random.js';

const PALETTE = [
  0xe8c9a0, 0xd9a06b, 0xc97b5e, 0xf2e3c9, 0xb8c4d4, 0xe0b48f, 0xcaa27e, 0x9fb4c7,
];

// A windowed wall: white wall with dark glass windows, a few of them lit.
// The material color tints the wall; the windows stay dark.
function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = Math.random() < 0.35;
      g.fillStyle = lit ? '#ffd27a' : '#2e3440';
      g.fillRect(12 + col * 28, 14 + row * 28, 16, 18);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = [];
    this.palms = [];
    this.lamps = [];
    this.seaMat = null;
    this.buildingTexture = windowTexture();
    this.buildGround();
    this.buildBlocks();
    this.buildCafe();
    this.buildGarage();
    this.buildBeach();
    this.buildSea();
  }

  addCollider(x, z, w, d) {
    const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
    this.colliders.push(c);
    return c;
  }

  // Push a circle (x, z, radius) out of every collider it overlaps.
  // Returns the corrected {x, z}.
  resolveCircle(x, z, radius) {
    for (const c of this.colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * radius;
          z = nz + (dz / d) * radius;
        } else {
          // Dead centre of the box: shove it out along the shortest side.
          const pushLeft = x - c.minX;
          const pushRight = c.maxX - x;
          const pushUp = z - c.minZ;
          const pushDown = c.maxZ - z;
          const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
          if (m === pushLeft) x = c.minX - radius;
          else if (m === pushRight) x = c.maxX + radius;
          else if (m === pushUp) z = c.minZ - radius;
          else z = c.maxZ + radius;
        }
      }
    }
    return { x, z };
  }

  // True when the point is inside any building box.
  insideBuilding(x, z) {
    for (const c of this.colliders) {
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
    }
    return false;
  }

  buildGround() {
    // Asphalt base for the whole city square; the blocks sit on top of it
    // and the gaps between them read as roads.
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.95 }),
    );
    base.rotation.x = -Math.PI / 2;
    base.receiveShadow = true;
    this.scene.add(base);

    // Lane dashes along every road, both directions.
    const dashGeo = new THREE.BoxGeometry(4, 0.06, 0.5);
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8c86a, roughness: 0.8 });
    for (const r of CONFIG.world.roads) {
      for (let t = -190; t <= 190; t += 16) {
        const d1 = new THREE.Mesh(dashGeo, dashMat);
        d1.position.set(t, 0.03, r);
        this.scene.add(d1);
        const d2 = new THREE.Mesh(dashGeo, dashMat);
        d2.rotation.y = Math.PI / 2;
        d2.position.set(r, 0.03, t);
        this.scene.add(d2);
      }
    }
  }

  buildBlocks() {
    const roads = CONFIG.world.roads;
    const centers = [];
    for (let i = 0; i < roads.length - 1; i += 1) {
      centers.push((roads[i] + roads[i + 1]) / 2);
    }
    const blockSize = 80 - CONFIG.world.roadWidth - CONFIG.world.sidewalkWidth * 2;
    for (const bx of centers) {
      for (const bz of centers) {
        // Grass block, slightly raised, with a pale sidewalk rim.
        const rim = new THREE.Mesh(
          new THREE.BoxGeometry(blockSize + 8, 0.3, blockSize + 8),
          new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 }),
        );
        rim.position.set(bx, 0.15, bz);
        rim.receiveShadow = true;
        this.scene.add(rim);
        const grass = new THREE.Mesh(
          new THREE.BoxGeometry(blockSize, 0.35, blockSize),
          new THREE.MeshStandardMaterial({ color: 0x6f9e5a, roughness: 1 }),
        );
        grass.position.set(bx, 0.18, bz);
        grass.receiveShadow = true;
        this.scene.add(grass);

        // One or two buildings per block, placed by the seeded rng.
        const count = rangeInt(this.rng, 1, 2);
        for (let b = 0; b < count; b += 1) {
          const w = range(this.rng, 16, 30);
          const d = range(this.rng, 16, 28);
          const h = range(this.rng, 8, 30);
          const ox = bx + range(this.rng, -14, 14);
          const oz = bz + range(this.rng, -14, 14);
          this.addBuilding(ox, oz, w, d, h);
        }

        // A palm or two on the block's corners.
        if (this.rng() < 0.7) {
          this.addPalm(bx + range(this.rng, -26, 26), bz + range(this.rng, -26, 26));
        }
      }
    }

    // Street lamps where the roads cross.
    for (const rx of roads) {
      for (const rz of roads) {
        this.addLamp(rx + 8, rz + 8);
      }
    }
  }

  addBuilding(x, z, w, d, h) {
    const tex = this.buildingTexture.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 12)));
    const mat = new THREE.MeshStandardMaterial({
      color: pick(this.rng, PALETTE),
      roughness: 0.9,
      map: tex,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2 + 0.3, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    // A flat roof cap, a shade darker.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 }),
    );
    roof.position.set(x, h + 0.55, z);
    this.scene.add(roof);
    this.addCollider(x, z, w, d);
  }

  buildCafe() {
    const { x, z, w, d, h } = CONFIG.cafe;
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0xe8b48a, roughness: 0.9 }),
    );
    walls.position.set(x, h / 2 + 0.3, z);
    walls.castShadow = true;
    walls.receiveShadow = true;
    this.scene.add(walls);
    // Terracotta roof and a striped awning over the front.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1, 0.8, d + 1),
      new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.85 }),
    );
    roof.position.set(x, h + 0.7, z);
    this.scene.add(roof);
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.8, 0.3, 4),
      new THREE.MeshStandardMaterial({ color: 0xf2e3c9, roughness: 0.9 }),
    );
    awning.position.set(x, 3.4, z + d / 2 + 1.6);
    awning.rotation.x = 0.35;
    this.scene.add(awning);
    // A couple of tables on the sand outside.
    for (const [tx, tz] of [[x - 5, z + 8], [x + 5, z + 8]]) {
      const table = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 0.25, 10),
        new THREE.MeshStandardMaterial({ color: 0xf2e3c9, roughness: 0.9 }),
      );
      table.position.set(tx, 0.9, tz);
      this.scene.add(table);
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x6b5a49, roughness: 1 }),
      );
      leg.position.set(tx, 0.45, tz);
      this.scene.add(leg);
    }
    this.addCollider(x, z, w, d);
  }

  buildGarage() {
    const { x, z, w, d, h } = CONFIG.garage;
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x8a94a6, roughness: 0.85, metalness: 0.25 }),
    );
    walls.position.set(x, h / 2 + 0.3, z);
    walls.castShadow = true;
    walls.receiveShadow = true;
    this.scene.add(walls);
    // A wide roller door on the north face, and a flat roof.
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.6, 5, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.7, metalness: 0.4 }),
    );
    door.position.set(x, 2.8, z - d / 2 - 0.15);
    this.scene.add(door);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      new THREE.MeshStandardMaterial({ color: 0x4a4f58, roughness: 1 }),
    );
    roof.position.set(x, h + 0.55, z);
    this.scene.add(roof);
    this.addCollider(x, z, w, d);
  }

  buildBeach() {
    // Sand from the city's east edge out to the water.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 440),
      new THREE.MeshStandardMaterial({ color: 0xe0c188, roughness: 1 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(223, 0.05, 0);
    sand.receiveShadow = true;
    this.scene.add(sand);
    // A row of palms along the sand.
    for (let z = -180; z <= 180; z += 36) {
      this.addPalm(214 + range(this.rng, -4, 4), z + range(this.rng, -6, 6));
    }
  }

  buildSea() {
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(190, 460),
      new THREE.MeshStandardMaterial({
        color: 0x2a7f8f, roughness: 0.25, metalness: 0.35,
        transparent: true, opacity: 0.94,
      }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(331, 0.02, 0);
    this.scene.add(sea);
    this.seaMat = sea.material;
  }

  addPalm(x, z) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.45, 7, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 1 }),
    );
    trunk.position.y = 3.5;
    trunk.rotation.z = range(this.rng, -0.08, 0.08);
    trunk.castShadow = true;
    group.add(trunk);
    // Five fronds fanning out of the crown.
    for (let i = 0; i < 5; i += 1) {
      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 4.4, 4),
        new THREE.MeshStandardMaterial({ color: 0x3f7d44, roughness: 1 }),
      );
      const a = (i / 5) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.6, 7.4, Math.sin(a) * 1.6);
      frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      frond.scale.set(1, 1, 0.28);
      group.add(frond);
    }
    const nut = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 }),
    );
    nut.position.y = 7.1;
    group.add(nut);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.palms.push(group);
  }

  addLamp(x, z) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.7, metalness: 0.5 }),
    );
    pole.position.y = 2.7;
    group.add(pole);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb84d, emissiveIntensity: 1.4 }),
    );
    bulb.position.y = 5.5;
    group.add(bulb);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.lamps.push(group);
  }
}
