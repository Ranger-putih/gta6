// Pedestrians: people walking the sidewalks, crossing at corners, running
// away when the player gets violent or the wanted level rises. A punched
// pedestrian goes down, then gets up and flees.
import * as THREE from 'three';
import { CITY } from './config.js';
import { collideCircle } from './city.js';

const SHIRTS = [0xe07856, 0x4fc3f7, 0xf2c94c, 0x7fb069, 0xe8b48c, 0x9fb8c8, 0xd9a441, 0xc96f9b];

function makePedMesh(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.4, 1.1, 8),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b98a }),
  );
  head.position.y = 1.75;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.5, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2e323d }),
  );
  legs.position.y = 0.25;
  group.add(legs);
  return group;
}

export function createPedestrians(scene, rng) {
  const peds = [];
  for (let i = 0; i < 14; i += 1) {
    const road = rng.pick(CITY.roads);
    const along = rng.range(-180, 180);
    const side = rng.next() < 0.5 ? 1 : -1;
    const horizontal = rng.next() < 0.5;
    const x = horizontal ? along : road + side * 11;
    const z = horizontal ? road + side * 11 : along;
    const mesh = makePedMesh(rng.pick(SHIRTS));
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      x,
      z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 2.0),
      state: 'walk',
      stateTime: 0,
      downTime: 0,
      fleeX: 0,
      fleeZ: 0,
    });
  }
  return {
    peds,
    update(dt, player, wanted, colliders, recentViolence) {
      peds.forEach((ped) => {
        ped.stateTime += dt;
        const distToPlayer = Math.hypot(ped.x - player.x, ped.z - player.z);
        const scared = recentViolence || wanted > 0;
        if (ped.state === 'down') {
          ped.downTime -= dt;
          ped.mesh.rotation.x = -Math.PI / 2;
          if (ped.downTime <= 0) {
            ped.state = 'flee';
            ped.stateTime = 0;
            ped.mesh.rotation.x = 0;
          }
          return;
        }
        if (scared && distToPlayer < 22 && ped.state !== 'flee') {
          ped.state = 'flee';
          ped.stateTime = 0;
          ped.fleeX = ped.x - player.x;
          ped.fleeZ = ped.z - player.z;
        }
        if (ped.state === 'flee') {
          if (distToPlayer > 30 || ped.stateTime > 6) {
            ped.state = 'walk';
            ped.stateTime = 0;
          } else {
            const len = Math.hypot(ped.fleeX, ped.fleeZ) || 1;
            const heading = Math.atan2(ped.fleeX / len, ped.fleeZ / len);
            ped.heading = heading;
            ped.x += Math.sin(heading) * 4.6 * dt;
            ped.z += Math.cos(heading) * 4.6 * dt;
          }
        } else {
          // Stroll the sidewalk; pick a new direction at intersections.
          if (ped.stateTime > 8 || rng.next() < 0.002) {
            ped.heading = Math.floor(rng.next() * 4) * (Math.PI / 2);
            ped.stateTime = 0;
          }
          ped.x += Math.sin(ped.heading) * ped.speed * dt;
          ped.z += Math.cos(ped.heading) * ped.speed * dt;
        }
        collideCircle(ped, 0.6, colliders);
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.heading;
        // Walk bob.
        ped.mesh.position.y = ped.state === 'walk' ? Math.abs(Math.sin(ped.stateTime * 6)) * 0.06 : 0;
      });
    },
  };
}
