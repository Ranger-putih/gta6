// City traffic: cars cruising the road grid on fixed lanes, wrapping at the
// city edge, braking for the car ahead and for the player's car.

import * as THREE from 'three';
import { WORLD, TRAFFIC_COUNT } from './config.js';
import { Rng } from './random.js';
import { buildCarMesh, Car } from './vehicles.js';

const TRAFFIC_COLORS = [0xb8b8b8, 0x3a3a3a, 0x8a2a2a, 0x2a4a6a, 0x6a6a2a, 0x4a6a4a, 0x7a7a7a, 0xa86a3a];
const MODELS = ['sedan', 'sedan', 'sedan', 'suv', 'pickup'];

export class Traffic {
  constructor(scene, rngSeed = 77) {
    const rng = new Rng(rngSeed);
    this.cars = [];
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    scene.add(this.group);
    for (let i = 0; i < TRAFFIC_COUNT; i++) {
      const axis = rng.chance(0.5) ? 'x' : 'z';
      const coord = rng.pick(WORLD.roadCoords);
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = rng.chance(0.5) ? 3 : -3;
      const along = rng.range(-190, 190);
      const model = rng.pick(MODELS);
      const mesh = buildCarMesh(rng.pick(TRAFFIC_COLORS), model);
      this.group.add(mesh);
      const car = new Car(mesh, { model, isTraffic: true });
      car.axis = axis;
      car.coord = coord;
      car.dir = dir;
      car.lane = lane;
      car.cruise = rng.range(8, 14);
      if (axis === 'x') {
        car.x = along;
        car.z = coord + lane;
        car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.x = coord + lane;
        car.z = along;
        car.heading = dir > 0 ? 0 : Math.PI;
      }
      car.speed = car.cruise;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      this.cars.push(car);
    }
  }

  update(dt, playerCar) {
    for (const car of this.cars) {
      // Brake for the vehicle ahead on the same lane, and for the player.
      let targetSpeed = car.cruise;
      const ahead = this._aheadDistance(car, playerCar);
      if (ahead !== null && ahead < 14) targetSpeed = 0;
      else if (ahead !== null && ahead < 26) targetSpeed = Math.min(targetSpeed, 5);
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
      const f = car.forward();
      car.x += f.x * car.speed * dt;
      car.z += f.z * car.speed * dt;
      const along = car.axis === 'x' ? car.x : car.z;
      if (along * car.dir > 198) {
        if (car.axis === 'x') car.x = -198 * car.dir;
        else car.z = -198 * car.dir;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
  }

  _aheadDistance(car, playerCar) {
    let best = null;
    const f = car.forward();
    const consider = (ox, oz) => {
      const dx = ox - car.x;
      const dz = oz - car.z;
      const along = dx * f.x + dz * f.z;
      if (along <= 0 || along > 30) return;
      const side = Math.abs(-dz * f.x + dx * f.z);
      if (side > 2.5) return;
      if (best === null || along < best) best = along;
    };
    for (const other of this.cars) {
      if (other === car) continue;
      consider(other.x, other.z);
    }
    if (playerCar) consider(playerCar.x, playerCar.z);
    return best;
  }

  // Remove a car from traffic (stolen by the player) and forget it.
  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    this.group.remove(car.mesh);
  }

  // Positions for the minimap.
  positions() {
    return this.cars.map((c) => ({ x: c.x, z: c.z }));
  }
}
