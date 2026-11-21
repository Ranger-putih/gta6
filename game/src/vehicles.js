// Cars: a mesh factory that builds a low-poly car from boxes, and the arcade
// driving model every car in the game shares — the player's car, the traffic
// and the police. Forward is (sin(heading), cos(heading)) on the ground.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, wrapAngle } from './random.js';

// Build a car mesh. `color` tints the body; `sport` adds a spoiler and
// wider wheels. Returns a THREE.Group whose +z is the car's forward.
export function makeCarMesh(color, sport = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color, roughness: 0.35, metalness: 0.55,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1a2733, roughness: 0.15, metalness: 0.7,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.9 });

  // Body: a low slab, a cabin on top, a hood line.
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.58, 2.1), glass);
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 1.0), paint);
  hood.position.set(0, 0.98, 1.55);
  group.add(hood);

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
  }

  // Headlights and taillights.
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0, emissive: 0xffedb0, emissiveIntensity: 0.9,
  });
  for (const sx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), lightMat);
    lamp.position.set(sx, 0.72, 2.22);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x881111, emissive: 0xaa2222, emissiveIntensity: 0.7,
  });
  for (const sx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.08), tailMat);
    lamp.position.set(sx, 0.72, -2.22);
    group.add(lamp);
  }

  if (sport) {
    // A rear spoiler and a lower, wider stance read as "sports car".
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.5), dark);
    wing.position.set(0, 1.15, -2.1);
    group.add(wing);
    for (const sx of [-0.8, 0.8]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), dark);
      strut.position.set(sx, 0.95, -2.1);
      group.add(strut);
    }
  }
  return group;
}

// One car in the world. `mesh` is its group; x/z/heading/speed are the sim.
export function makeCar(mesh, x, z, heading) {
  return {
    mesh, x, z, heading, speed: 0,
    // Steering angle the wheels are at (visual only, eased toward target).
    steerVis: 0,
  };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
}

// Arcade driving: throttle in -1..1 (forward/back), steer in -1..1 (D is
// positive: it decreases the heading, which turns the car toward +x when
// heading is near PI). Speed eases toward its target with drag, and the
// heading turns faster the faster the car goes. Returns the new speed.
export function driveCar(car, dt, throttle, steer, colliders, resolveCircle) {
  const cfg = CONFIG.cars;
  let target = 0;
  if (throttle > 0) target = cfg.maxSpeed * throttle;
  else if (throttle < 0) target = cfg.maxReverse * throttle;
  // Approach the target speed with acceleration, then drag.
  const accel = throttle > 0 ? cfg.accel : throttle < 0 ? cfg.reverseAccel : cfg.brake;
  const diff = target - car.speed;
  const step = accel * dt;
  car.speed += clamp(diff, -step, step);
  car.speed *= (1 - cfg.drag * dt);
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;

  // Steering only bites while moving; it reverses when backing up.
  const steerAmount = steer * cfg.steerRate * clamp(Math.abs(car.speed) / 12, 0, 1);
  car.heading -= steerAmount * dt * Math.sign(car.speed || 1);
  car.heading = wrapAngle(car.heading);

  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  // Keep the car inside the world and out of buildings.
  nx = clamp(nx, -CONFIG.world.half + 2, CONFIG.world.half + 44);
  nz = clamp(nz, -CONFIG.world.half + 2, CONFIG.world.half + 2);
  if (resolveCircle) {
    const fixed = resolveCircle(nx, nz, 1.5);
    // A hard stop on the wall: hitting a building kills the speed.
    if (fixed.x !== nx || fixed.z !== nz) car.speed *= 0.3;
    nx = fixed.x;
    nz = fixed.z;
  }
  car.x = nx;
  car.z = nz;
  car.steerVis += (steer * 0.45 - car.steerVis) * Math.min(1, dt * 8);
  syncCarMesh(car);
  return car.speed;
}
