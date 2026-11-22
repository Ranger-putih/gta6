// Sunset Bay PD: wanted levels 1-5, cruisers that chase and ram, foot
// cops that bust the player on foot, and a police helicopter with a
// spotlight at 4 stars and above. Wanted decays one star per quiet period.

import * as THREE from 'three';
import { WANTED_DECAY_SECONDS } from './config.js';
import { buildCarMesh, Car } from './vehicles.js';

export class Police {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'police';
    scene.add(this.group);
    this.wanted = 0;
    this.quietTime = 0;
    this.cruisers = [];
    this.cops = [];
    this.bustProgress = 0;
    this.heli = this._buildHeli();
    this.group.add(this.heli.group);
    this.heli.group.visible = false;
    this._flashT = 0;
  }

  _buildHeli() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.6, 5.5),
      new THREE.MeshLambertMaterial({ color: 0x2a3a5a }),
    );
    body.position.y = 0;
    group.add(body);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 4.5),
      new THREE.MeshLambertMaterial({ color: 0x2a3a5a }),
    );
    tail.position.set(0, 0.2, -4.2);
    group.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.12, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x1a1d22 }),
    );
    rotor.position.y = 1.1;
    group.add(rotor);
    const tailRotor = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 2.2, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x1a1d22 }),
    );
    tailRotor.position.set(0.5, 0.3, -6.2);
    group.add(tailRotor);
    const spot = new THREE.SpotLight(0xfff2c0, 900, 90, 0.32, 0.5, 1.2);
    spot.position.set(0, -0.8, 1.5);
    group.add(spot);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 32, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.rotation.x = Math.PI;
    cone.position.set(0, -17, 1.5);
    group.add(cone);
    return { group, rotor, spot, cone, x: 0, z: 0 };
  }

  setWanted(n) {
    const next = Math.max(0, Math.min(5, Math.round(n)));
    if (next > this.wanted) this.quietTime = 0;
    this.wanted = next;
  }

  addHeat(n) {
    this.setWanted(this.wanted + n);
    this.quietTime = 0;
  }

  commitCrime() {
    this.quietTime = 0;
  }

  wantedCount() {
    return this.wanted;
  }

  _wantedCruisers() {
    return [0, 1, 2, 3, 4, 5][this.wanted];
  }

  _wantedCops() {
    return this.wanted >= 2 ? 2 : this.wanted >= 1 ? 1 : 0;
  }

  _spawnCruiser(scene, nearX, nearZ) {
    const mesh = buildCarMesh(0x1a2a4a, 'cruiser');
    this.group.add(mesh);
    const car = new Car(mesh, { model: 'cruiser', name: 'Cruiser' });
    car.x = nearX + (Math.random() - 0.5) * 30;
    car.z = nearZ + (Math.random() - 0.5) * 30;
    car.heading = Math.random() * Math.PI * 2;
    car.speed = 10;
    this.cruisers.push(car);
    return car;
  }

  _spawnCop(nearX, nearZ) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 1.05, 8),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }),
    );
    body.position.y = 0.85;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
    );
    head.position.y = 1.62;
    group.add(head);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x0a1428 }),
    );
    cap.position.y = 1.82;
    group.add(cap);
    group.position.set(nearX, 0, nearZ);
    this.group.add(group);
    const cop = { mesh: group, x: nearX, z: nearZ, heading: 0 };
    this.cops.push(cop);
    return cop;
  }

  update(dt, player, colliders, onBusted, onDamage) {
    // Wanted decay: one star per quiet period with no new crime.
    if (this.wanted > 0) {
      this.quietTime += dt;
      if (this.quietTime >= WANTED_DECAY_SECONDS) {
        this.wanted -= 1;
        this.quietTime = 0;
      }
    }

    // Cruisers: spawn up to the wanted count, despawn the excess.
    const wantCruisers = this._wantedCruisers();
    while (this.cruisers.length < wantCruisers) {
      this._spawnCruiser(null, player.x, player.z);
    }
    while (this.cruisers.length > wantCruisers) {
      const c = this.cruisers.pop();
      this.group.remove(c.mesh);
    }
    for (const c of this.cruisers) {
      const dx = player.x - c.x;
      const dz = player.z - c.z;
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.6));
      // Chase, but hold a ring around a slow or stationary player car
      // instead of grinding it to scrap: rams only land on a car that is
      // actually fleeing, and they are a shove, not the main threat.
      const playerMoving = player.car ? Math.abs(player.car.speed) > 8 : true;
      const throttle = d > 8 ? 1 : playerMoving ? 0.4 : 0;
      c.drive(throttle, steer, dt, colliders);
      c.ramCd = Math.max(0, (c.ramCd || 0) - dt);
      if (d < 3.2 && c.ramCd <= 0 && playerMoving) {
        // Ram: one shove with a cooldown, then back off and re-approach.
        c.ramCd = 2.0;
        if (player.car) player.car.damage(3);
        else if (onDamage) onDamage(6, 'ram');
        c.speed = -8;
      }
    }

    // Foot cops chase on foot and bust after 2 s in arm's reach.
    const wantCops = this._wantedCops();
    while (this.cops.length < wantCops) {
      this._spawnCop(player.x + (Math.random() - 0.5) * 40, player.z + (Math.random() - 0.5) * 40);
    }
    while (this.cops.length > wantCops) {
      const c = this.cops.pop();
      this.group.remove(c.mesh);
    }
    let nearestCop = Infinity;
    for (const cop of this.cops) {
      const dx = player.x - cop.x;
      const dz = player.z - cop.z;
      const d = Math.hypot(dx, dz);
      nearestCop = Math.min(nearestCop, d);
      const wantHeading = Math.atan2(dx, dz);
      cop.heading = wantHeading;
      const speed = player.car ? 5.5 : 3.4;
      cop.x += Math.sin(wantHeading) * speed * dt;
      cop.z += Math.cos(wantHeading) * speed * dt;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    }
    if (!player.car && this.wanted > 0 && nearestCop < 2.6) {
      this.bustProgress += dt;
      if (this.bustProgress > 2 && onBusted) onBusted();
    } else {
      this.bustProgress = Math.max(0, this.bustProgress - dt * 2);
    }

    // Helicopter at 4 stars and up: hovers above the player, spotlight on.
    const heliOn = this.wanted >= 4;
    this.heli.group.visible = heliOn;
    if (heliOn) {
      this._flashT += dt;
      this.heli.x += (player.x - this.heli.x) * Math.min(1, dt * 0.9);
      this.heli.z += (player.z - this.heli.z) * Math.min(1, dt * 0.9);
      this.heli.group.position.set(this.heli.x, 34, this.heli.z);
      this.heli.group.rotation.y = Math.atan2(player.x - this.heli.x, player.z - this.heli.z);
      this.heli.rotor.rotation.y += dt * 22;
      this.heli.spot.target.position.set(player.x - this.heli.x, -34, player.z - this.heli.z);
      this.heli.spot.target.updateMatrixWorld();
      this.heli.cone.material.opacity = 0.08 + 0.04 * Math.sin(this._flashT * 6);
    }
  }

  positions() {
    return {
      cruisers: this.cruisers.map((c) => ({ x: c.x, z: c.z })),
      cops: this.cops.map((c) => ({ x: c.x, z: c.z })),
      heli: this.wanted >= 4 ? { x: this.heli.x, z: this.heli.z } : null,
    };
  }
}
