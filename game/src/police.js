// The wanted system and the police. Crimes raise the wanted level (1 to 5
// stars); police cars spawn at the city edge and chase the player, ram the
// player's car, and bust the player on foot if they stay close for long
// enough. When no police car is near for a while, the heat fades — which is
// exactly what the third mission asks the player to do.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, dist2d, angleTo } from './random.js';
import { makeCarMesh, makeCar, syncCarMesh, driveCar } from './vehicles.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.wanted = 0;
    this.cars = [];
    this.noCopNearTimer = 0;
    this.bustTimer = 0;
    this.busted = false;
    // A flashing light bar each police car carries.
    this.beacons = [];
  }

  addWanted(n) {
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.noCopNearTimer = 0;
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, 5);
    this.noCopNearTimer = 0;
  }

  spawnCar(x, z, heading) {
    const mesh = makeCarMesh(0x1a2a44);
    // A white door stripe and a light bar read as "police" at a glance.
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
    );
    stripe.position.y = 0.75;
    mesh.add(stripe);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xff2222, emissiveIntensity: 2 }),
    );
    red.position.set(-0.4, 1.52, -0.25);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2244cc, emissive: 0x2244ff, emissiveIntensity: 2 }),
    );
    blue.position.set(0.4, 1.52, -0.25);
    bar.add(red);
    bar.add(blue);
    mesh.add(bar);
    this.scene.add(mesh);
    const car = makeCar(mesh, x, z, heading);
    car.beaconRed = red;
    car.beaconBlue = blue;
    car.beaconPhase = Math.random() * Math.PI * 2;
    this.cars.push(car);
    syncCarMesh(car);
    return car;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  // How many police cars the wanted level calls for.
  wantedCars() {
    return this.wanted;
  }

  update(dt, player, elapsed) {
    // Spawn up to the wanted count, at the city edge nearest the player.
    while (this.cars.length < this.wantedCars()) {
      const edge = [
        { x: player.x + 60, z: -190 }, { x: player.x - 60, z: 190 },
        { x: -190, z: player.z + 60 }, { x: 190, z: player.z - 60 },
      ][this.cars.length % 4];
      const x = clamp(edge.x, -195, 195);
      const z = clamp(edge.z, -195, 195);
      const heading = Math.atan2(player.x - x, player.z - z);
      this.spawnCar(x, z, heading);
    }
    // Despawn extras when the heat drops.
    while (this.cars.length > this.wantedCars()) {
      this.removeCar(this.cars[this.cars.length - 1]);
    }

    let nearest = Infinity;
    for (const car of this.cars) {
      // Chase: steer toward the player, throttle hard, and ram.
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      const wantHeading = Math.atan2(dx, dz);
      const steer = clamp(angleTo(car.heading, wantHeading) * 1.4, -1, 1);
      const throttle = dist > 4 ? 1 : 0.4;
      driveCar(car, dt, throttle, steer, this.city.colliders, (x, z, r) => this.city.resolveCircle(x, z, r));
      // A ram: a hard hit on the player's car shoves it and slows it.
      if (dist < 3.4 && player.inCar && player.car) {
        player.car.speed *= 0.92;
        player.car.x += (player.car.x - car.x) * 0.02;
        player.car.z += (player.car.z - car.z) * 0.02;
      }
      // Flash the light bar, alternating red and blue.
      const phase = (elapsed * 6 + car.beaconPhase) % (Math.PI * 2);
      const redOn = phase < Math.PI;
      car.beaconRed.material.emissiveIntensity = redOn ? 2.5 : 0.2;
      car.beaconBlue.material.emissiveIntensity = redOn ? 0.2 : 2.5;
    }

    // Busted: on foot, a cop this close for long enough ends the run.
    if (!player.inCar && this.wanted > 0 && nearest < CONFIG.wanted.bustRadius) {
      this.bustTimer += dt;
      if (this.bustTimer >= CONFIG.wanted.bustSeconds) {
        this.busted = true;
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }

    // The heat fades when no police car is near for long enough.
    if (nearest > 45) {
      this.noCopNearTimer += dt;
      if (this.noCopNearTimer >= CONFIG.wanted.decayAfterSeconds && this.wanted > 0) {
        this.wanted = Math.max(0, this.wanted - CONFIG.wanted.decayPerSecond * dt);
        if (this.wanted < 0.5) this.wanted = 0;
      }
    } else {
      this.noCopNearTimer = 0;
    }
  }

  // Hurt a police car at (x, z); returns the car hit, if any.
  hurtAt(x, z, radius, damage) {
    for (const car of this.cars) {
      if (dist2d(car.x, car.z, x, z) < radius) {
        car.health = (car.health || CONFIG.combat.copHealth) - damage;
        if (car.health <= 0) {
          // A wrecked cruiser stops where it is and its driver gives up.
          car.speed = 0;
          this.removeCar(car);
          this.addWanted(1);
        }
        return car;
      }
    }
    return null;
  }

  dots() {
    return this.cars.map((c) => ({ x: c.x, z: c.z }));
  }
}
