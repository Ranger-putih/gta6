// Combat: a punch for close quarters and a pistol for distance. A punch
// knocks a pedestrian down; a shot can drop one or disable a car (which
// starts smoking). Both raise the wanted level — the world applies that.
import * as THREE from 'three';
import { TUNE } from './config.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createCombat(scene) {
  const tracerGeo = new THREE.BufferGeometry();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.frustumCulled = false;
  scene.add(tracer);
  let tracerTtl = 0;
  let punchCooldown = 0;
  let shootCooldown = 0;
  const smokes = [];

  function addSmoke(car) {
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6 }),
    );
    smoke.position.set(car.x, 1.6, car.z);
    scene.add(smoke);
    smokes.push({ mesh: smoke, car, t: 0 });
  }

  return {
    update(dt) {
      punchCooldown = Math.max(0, punchCooldown - dt);
      shootCooldown = Math.max(0, shootCooldown - dt);
      if (tracerTtl > 0) {
        tracerTtl -= dt;
        tracerMat.opacity = Math.max(0, tracerTtl / 0.08) * 0.9;
      }
      smokes.forEach((s) => {
        s.t += dt;
        s.mesh.position.set(s.car.x, 1.6 + (s.t % 1.5) * 1.2, s.car.z);
        s.mesh.material.opacity = 0.6 * (1 - (s.t % 1.5) / 1.5);
        const scale = 1 + (s.t % 1.5) * 0.8;
        s.mesh.scale.set(scale, scale, scale);
      });
    },
    /** Punch what is in front of the player. Returns 'ped' when one went down. */
    punch(player, peds) {
      if (punchCooldown > 0) return null;
      punchCooldown = 0.45;
      let hit = null;
      peds.forEach((ped) => {
        if (ped.state === 'down') return;
        const dx = ped.x - player.x;
        const dz = ped.z - player.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 2.4) return;
        if (Math.abs(angleDiff(Math.atan2(dx, dz), player.heading)) > 1.1) return;
        hit = ped;
      });
      return hit;
    },
    /** Fire the pistol along (dirX, dirZ). Returns what was hit, if anything. */
    shoot(player, dirX, dirZ, peds, cars) {
      if (shootCooldown > 0) return null;
      shootCooldown = 0.35;
      const range = TUNE.gunRange;
      let best = null;
      let bestT = range;
      function testCircle(x, z, r, what) {
        const cx = x - player.x;
        const cz = z - player.z;
        const t = cx * dirX + cz * dirZ;
        if (t < 0 || t > bestT) return;
        const px = cx - dirX * t;
        const pz = cz - dirZ * t;
        if (Math.hypot(px, pz) < r) {
          bestT = t;
          best = what;
        }
      }
      peds.forEach((ped) => {
        if (ped.state !== 'down') testCircle(ped.x, ped.z, 0.8, { type: 'ped', ped });
      });
      cars.forEach((car) => {
        if (!car.disabled) testCircle(car.x, car.z, 2.3, { type: 'car', car });
      });
      const endX = player.x + dirX * bestT;
      const endZ = player.z + dirZ * bestT;
      tracerGeo.setFromPoints([
        new THREE.Vector3(player.x, 1.4, player.z),
        new THREE.Vector3(endX, 1.2, endZ),
      ]);
      tracerTtl = 0.08;
      tracerMat.opacity = 0.9;
      if (best && best.type === 'car') {
        best.car.health -= TUNE.gunDamage;
        if (best.car.health <= 0) {
          best.car.disabled = true;
          best.car.speed = 0;
          addSmoke(best.car);
        }
      }
      return best;
    },
  };
}
