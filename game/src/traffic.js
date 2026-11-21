// Traffic for Vice Rush. Twenty cars cruise the road grid, each on one
// road at a time, turning at crossings the way city drivers do. They
// keep the streets alive, they give the player something to dodge, and
// they are the reason a chase through Downtown feels crowded.

import { Car } from './vehicles.js';
import { ROADS, CITY_HALF } from './config.js';
import { rng } from './random.js';

const TRAFFIC_MODELS = ['sedan', 'sedan', 'pickup', 'van', 'taxi', 'sports'];

export class Traffic {
  constructor(scene, collide) {
    this.scene = scene;
    this.collide = collide;
    this.cars = [];
  }

  spawn(count) {
    for (let i = 0; i < count; i++) {
      const vertical = rng.chance(0.5);
      const road = rng.pick(ROADS);
      const along = rng.range(-CITY_HALF + 20, CITY_HALF - 20);
      const dir = rng.chance(0.5) ? 1 : -1;
      const model = rng.pick(TRAFFIC_MODELS);
      const x = vertical ? road : along;
      const z = vertical ? along : road;
      // Heading follows the road: north is PI, south is 0, east is PI/2,
      // west is -PI/2, because forward is (sin h, cos h).
      let heading;
      if (vertical) heading = dir > 0 ? 0 : Math.PI;
      else heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const car = new Car(model, x, z, heading);
      car.traffic = true;
      car.speed = rng.range(8, 13);
      car.road = { vertical, road, dir };
      this.cars.push(car);
      this.scene.add(car.mesh);
    }
  }

  update(dt, playerCar) {
    for (const car of this.cars) {
      const r = car.road;
      // At a crossing, sometimes turn onto the crossing road.
      const onCrossing = ROADS.some((c) => Math.abs((r.vertical ? car.z : car.x) - c) < 4);
      if (onCrossing && rng.chance(dt * 0.12)) {
        const cross = r.vertical ? car.z : car.x;
        const nearest = ROADS.reduce((a, b) => (Math.abs(b - cross) < Math.abs(a - cross) ? b : a));
        const turnLeft = rng.chance(0.5);
        if (r.vertical) {
          car.road = { vertical: false, road: nearest, dir: turnLeft ? -1 : 1 };
          car.heading = turnLeft ? -Math.PI / 2 : Math.PI / 2;
          car.z = nearest;
        } else {
          car.road = { vertical: true, road: nearest, dir: turnLeft ? 1 : -1 };
          car.heading = turnLeft ? 0 : Math.PI;
          car.x = nearest;
        }
      }
      // Near the edge of the city, turn around.
      const along = r.vertical ? car.z : car.x;
      if (along > CITY_HALF - 12 && r.dir > 0) {
        r.dir = -1;
        car.heading += Math.PI;
      } else if (along < -CITY_HALF + 12 && r.dir < 0) {
        r.dir = 1;
        car.heading += Math.PI;
      }
      // Ease back toward a cruising speed, then roll.
      const target = rng.chance(0.5) ? 11 : 12;
      car.speed += (target - car.speed) * dt * 0.5;
      const nx = car.x + car.forwardX * car.speed * dt;
      const nz = car.z + car.forwardZ * car.speed * dt;
      if (!this.collide(nx, nz, 1.4)) {
        car.x = nx;
        car.z = nz;
      } else {
        // Blocked: nudge the heading a little and slow down.
        car.heading += 0.6 * dt;
        car.speed *= 0.9;
      }
      car.syncMesh();

      // A traffic car that taps the player's car dents it and pushes it.
      if (playerCar) {
        const dx = playerCar.x - car.x;
        const dz = playerCar.z - car.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 9 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (3 - d) * 0.5;
          playerCar.x += (dx / d) * push;
          playerCar.z += (dz / d) * push;
          if (Math.abs(playerCar.speed) > 8) {
            playerCar.damage(1.5);
            car.speed *= 0.7;
          }
        }
      }
    }
  }
}
