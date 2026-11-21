// Traffic: cars that drive the road grid on their own. Each one picks a road,
// drives along it, and turns onto another road at an intersection. They keep
// their distance from the car ahead and from the player, and they never
// reverse. All of it is deterministic from the seeded rng.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { range, rangeInt, pick } from './random.js';
import { makeCarMesh, makeCar, syncCarMesh } from './vehicles.js';

const TRAFFIC_COLORS = [0x4a6b8a, 0x8a4a4a, 0x5a5a5a, 0x7a7a3a, 0x3a6b5a, 0x9a9a9a];

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    const roads = CONFIG.world.roads;
    for (let i = 0; i < CONFIG.cars.trafficCount; i += 1) {
      // Start on a random road, on the right-hand side of it.
      const alongX = this.rng() < 0.5;
      const road = pick(rng, roads);
      const t = range(rng, -170, 170);
      const x = alongX ? t : road + 3;
      const z = alongX ? road + 3 : t;
      const heading = alongX ? (t > 0 ? Math.PI : 0) : (t > 0 ? -Math.PI / 2 : Math.PI / 2);
      const mesh = makeCarMesh(pick(rng, TRAFFIC_COLORS));
      scene.add(mesh);
      const car = makeCar(mesh, x, z, heading);
      car.speed = range(rng, 7, CONFIG.cars.trafficSpeed);
      car.alongX = alongX;
      car.road = road;
      car.side = 3;
      car.targetSpeed = car.speed;
      this.cars.push(car);
      syncCarMesh(car);
    }
  }

  // The nearest intersection ahead on this car's road.
  nextIntersection(car) {
    const roads = CONFIG.world.roads;
    const pos = car.alongX ? car.x : car.z;
    const dir = car.alongX
      ? (Math.sin(car.heading) > 0 ? 1 : -1)
      : (Math.cos(car.heading) > 0 ? 1 : -1);
    let best = null;
    for (const r of roads) {
      const d = (r - pos) * dir;
      if (d > 4 && (best === null || d < best)) best = d;
    }
    return best === null ? 999 : best;
  }

  update(dt, playerPos) {
    for (const car of this.cars) {
      // Slow down for the car ahead or for the player in front.
      let want = car.targetSpeed;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const ahead = car.alongX
          ? dx * Math.sin(car.heading) + dz * Math.cos(car.heading)
          : dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const dist = Math.hypot(dx, dz);
        if (ahead > 0 && ahead < 12 && dist < 12) want = Math.min(want, 4);
      }
      if (playerPos) {
        const dx = playerPos.x - car.x;
        const dz = playerPos.z - car.z;
        const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const dist = Math.hypot(dx, dz);
        if (ahead > 0 && ahead < 10 && dist < 10) want = Math.min(want, 2.5);
      }
      car.speed += (want - car.speed) * Math.min(1, dt * 1.5);

      // Drive forward; turn at an intersection onto a crossing road.
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      car.x += fx * car.speed * dt;
      car.z += fz * car.speed * dt;
      const distToTurn = this.nextIntersection(car);
      if (distToTurn < 6 && this.rng() < 0.02 + dt * 0.6) {
        // Snap onto the crossing road and pick a new direction along it.
        const roads = CONFIG.world.roads;
        const cross = car.alongX ? car.z : car.x;
        let nearest = roads[0];
        for (const r of roads) {
          if (Math.abs(r - cross) < Math.abs(nearest - cross)) nearest = r;
        }
        if (car.alongX) {
          car.z = nearest + 3;
          car.alongX = false;
          car.heading = this.rng() < 0.5 ? 0 : Math.PI;
        } else {
          car.x = nearest + 3;
          car.alongX = true;
          car.heading = this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        }
        car.road = nearest;
      }
      // Wrap around the city edge instead of driving off the map.
      if (car.x > 198) { car.x = -198; }
      if (car.x < -198) { car.x = 198; }
      if (car.z > 198) { car.z = -198; }
      if (car.z < -198) { car.z = 198; }
      syncCarMesh(car);
    }
  }

  // Cars as plain dots for the minimap.
  dots() {
    return this.cars.map((c) => ({ x: c.x, z: c.z }));
  }
}
