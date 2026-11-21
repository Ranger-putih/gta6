// Traffic: AI cars that loop around city blocks in the right-hand lane,
// stopping for the car ahead. They give the streets life and something to
// dodge while driving.
import { CITY } from './config.js';
import { makeCar, syncCarMesh } from './vehicles.js';
import { collideCircle } from './city.js';

const TRAFFIC_COLORS = [0xd9d9d9, 0x8a94a6, 0x5a6b7d, 0xb03a2e, 0x2e86ab, 0xe8b48c, 0x3d9970];
const LANE = 3.5;

/** Waypoints for a loop around one block, in the right-hand lane of each road. */
function loopWaypoints(bx, bz) {
  const half = CITY.pitch / 2;
  const lane = half + LANE;
  return [
    { x: bx - lane, z: bz + lane },
    { x: bx + lane, z: bz + lane },
    { x: bx + lane, z: bz - lane },
    { x: bx - lane, z: bz - lane },
  ];
}

export function createTraffic(scene, rng) {
  const cars = [];
  const blockCentres = [-120, -40, 40, 120];
  for (let i = 0; i < 10; i += 1) {
    const bx = rng.pick(blockCentres);
    const bz = rng.pick(blockCentres);
    const kind = rng.next() < 0.15 ? 'taxi' : 'traffic';
    const color = kind === 'taxi' ? 0xf2c94c : rng.pick(TRAFFIC_COLORS);
    const waypoints = loopWaypoints(bx, bz);
    const start = rng.int(0, 3);
    const car = makeCar(kind, color, waypoints[start].x, waypoints[start].z, 0);
    car.speed = rng.range(9, 13);
    car.waypoints = waypoints;
    car.wp = (start + 1) % 4;
    car.baseSpeed = car.speed;
    car.stopped = false;
    scene.add(car.mesh);
    cars.push(car);
  }
  return {
    cars,
    update(dt, playerCar, colliders) {
      cars.forEach((car) => {
        if (car.disabled) return;
        const target = car.waypoints[car.wp];
        const dx = target.x - car.x;
        const dz = target.z - car.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3) {
          car.wp = (car.wp + 1) % 4;
          return;
        }
        const wantedHeading = Math.atan2(dx, dz);
        let diff = wantedHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        // Stop for the car ahead (traffic, police or the player).
        let blocked = false;
        const ahead = { x: car.x + Math.sin(car.heading) * 7, z: car.z + Math.cos(car.heading) * 7 };
        const all = playerCar ? [...cars, playerCar] : cars;
        all.forEach((other) => {
          if (other === car || other.disabled) return;
          if (Math.hypot(other.x - ahead.x, other.z - ahead.z) < 3.5) blocked = true;
        });
        car.stopped = blocked;
        const targetSpeed = blocked ? 0 : car.baseSpeed;
        car.speed += (targetSpeed - car.speed) * Math.min(1, 2 * dt);
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        car.spin += (car.speed * dt) / 0.42;
        collideCircle(car, 2.3, colliders);
        syncCarMesh(car);
      });
    },
  };
}
