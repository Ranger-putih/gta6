// Cars: one box-built mesh factory (body, cabin, wheels, lights) and the
// arcade driving physics the player car uses. A car's forward is its local
// +Z; heading is rotation.y, so forward = (sin(heading), 0, cos(heading)).
import * as THREE from 'three';
import { TUNE } from './config.js';
import { collideCircle } from './city.js';

const WHEEL_R = 0.42;

function makeWheel() {
  const steer = new THREE.Group();
  const spin = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.35, 10),
    new THREE.MeshLambertMaterial({ color: 0x16181d }),
  );
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  spin.add(tyre);
  steer.add(spin);
  steer.userData.spin = spin;
  return steer;
}

/** A stylised car. kind: 'player' | 'parked' | 'traffic' | 'police' | 'sports' | 'taxi'. */
export function makeCarMesh(color, kind) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1d2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.25, -0.3);
  cabin.castShadow = true;
  group.add(cabin);
  if (kind === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.4), bodyMat);
    spoiler.position.set(0, 1.15, -2.1);
    group.add(spoiler);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xf2c94c }),
    );
    sign.position.set(0, 1.7, -0.3);
    group.add(sign);
  }
  // Headlights and tail lights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xe5534b });
  [-0.65, 0.65].forEach((x) => {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headMat);
    head.position.set(x, 0.65, 2.21);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
    tail.position.set(x, 0.65, -2.21);
    group.add(tail);
  });
  let lightBar = null;
  if (kind === 'police') {
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
    );
    red.position.set(-0.45, 1.68, -0.3);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2a6bff }),
    );
    blue.position.set(0.45, 1.68, -0.3);
    group.add(red);
    group.add(blue);
    lightBar = { red, blue };
  }
  const wheels = [];
  const wheelSpots = [
    [-0.95, 1.45, true],
    [0.95, 1.45, true],
    [-0.95, -1.45, false],
    [0.95, -1.45, false],
  ];
  wheelSpots.forEach(([x, z, front]) => {
    const wheel = makeWheel();
    wheel.position.set(x, WHEEL_R, z);
    wheel.userData.front = front;
    group.add(wheel);
    wheels.push(wheel);
  });
  group.userData.wheels = wheels;
  group.userData.lightBar = lightBar;
  return group;
}

/** A car entity: position, heading, speed and its mesh. */
export function makeCar(kind, color, x, z, heading) {
  const mesh = makeCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    kind,
    color,
    mesh,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    maxSpeed: kind === 'sports' ? TUNE.sportsMax : TUNE.carMax,
    health: 100,
    disabled: false,
    crashCooldown: 0,
    spin: 0,
  };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spinAngle = car.spin || 0;
  car.mesh.userData.wheels.forEach((wheel) => {
    wheel.userData.spin.rotation.x = spinAngle;
    wheel.rotation.y = wheel.userData.front ? car.steer * 0.45 : 0;
  });
  if (car.mesh.userData.lightBar) {
    const on = Math.floor(performance.now() / 260) % 2 === 0;
    car.mesh.userData.lightBar.red.visible = on;
    car.mesh.userData.lightBar.blue.visible = !on;
  }
}

/**
 * One arcade driving step for the player's car. throttle in [-1, 1],
 * steerInput in [-1, 1]. Returns true when it hit something hard.
 */
export function stepPlayerCar(car, throttle, steerInput, dt, colliders, others, onCrash) {
  const max = car.maxSpeed;
  if (throttle > 0) car.speed += TUNE.carAccel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= TUNE.carBrake * dt;
    else car.speed += TUNE.carReverse * -throttle * dt;
  } else {
    car.speed -= car.speed * 1.6 * dt;
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
  }
  car.speed = Math.max(-TUNE.carReverse, Math.min(max, car.speed));
  const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
  car.steer = steerInput * speedFactor;
  // D turns right: heading falls while moving forward, and flips in reverse.
  car.heading -= car.steer * TUNE.steerRate * dt * (car.speed < 0 ? -1 : 1);
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;
  car.spin += (car.speed * dt) / WHEEL_R;

  let crashed = false;
  const before = { x: car.x, z: car.z };
  collideCircle(car, TUNE.carRadius, colliders);
  if ((car.x !== before.x || car.z !== before.z) && Math.abs(car.speed) > 8) {
    crashed = true;
    car.speed *= 0.45;
  }
  // Push apart from the other cars.
  others.forEach((other) => {
    if (other === car || other.disabled) return;
    const dx = car.x - other.x;
    const dz = car.z - other.z;
    const d = Math.hypot(dx, dz);
    const min = TUNE.carRadius * 2;
    if (d > 0.001 && d < min) {
      const push = (min - d) / 2;
      const nx = dx / d;
      const nz = dz / d;
      car.x += nx * push;
      car.z += nz * push;
      other.x -= nx * push;
      other.z -= nz * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 6 && car.crashCooldown <= 0) {
        crashed = true;
        car.speed *= 0.7;
        other.speed *= 0.7;
        car.crashCooldown = 0.8;
        if (onCrash) onCrash(rel);
      }
    }
  });
  car.crashCooldown = Math.max(0, car.crashCooldown - dt);
  syncCarMesh(car);
  return crashed;
}
