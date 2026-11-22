// Vehicles for Vice Rush: low-poly cars and a bike built from boxes and
// cylinders, plus the Car class that drives them with simple arcade physics.

import * as THREE from 'three';

const MODEL_STATS = {
  sedan: { top: 30, accel: 13, turn: 1.9, len: 4.4, wid: 1.9, height: 0.85 },
  sports: { top: 42, accel: 18, turn: 2.1, len: 4.2, wid: 1.8, height: 0.7 },
  suv: { top: 27, accel: 11, turn: 1.7, len: 4.8, wid: 2.0, height: 1.1 },
  pickup: { top: 28, accel: 12, turn: 1.8, len: 5.0, wid: 2.0, height: 1.0 },
  bike: { top: 38, accel: 16, turn: 2.4, len: 2.4, wid: 0.7, height: 0.8 },
  cruiser: { top: 34, accel: 15, turn: 2.0, len: 4.6, wid: 1.9, height: 0.9 },
};

export function buildCarMesh(color, model = 'sedan') {
  const stats = MODEL_STATS[model] || MODEL_STATS.sedan;
  const group = new THREE.Group();
  group.name = `car-${model}`;
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });

  if (model === 'bike') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.2), bodyMat);
    frame.position.y = 0.55;
    group.add(frame);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.9), darkMat);
    seat.position.set(0, 0.85, -0.3);
    group.add(seat);
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.18, 12);
    for (const z of [-0.85, 0.85]) {
      const w = new THREE.Mesh(wheelGeo, darkMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(0, 0.38, z);
      group.add(w);
    }
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    lamp.position.set(0, 0.6, 1.12);
    group.add(lamp);
    group.userData.stats = stats;
    return group;
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(stats.wid, stats.height, stats.len), bodyMat);
  body.position.y = stats.height / 2 + 0.35;
  group.add(body);

  const cabinLen = model === 'pickup' ? stats.len * 0.32 : stats.len * 0.45;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(stats.wid * 0.82, stats.height * 0.75, cabinLen),
    glassMat,
  );
  cabin.position.set(0, stats.height + 0.35 + stats.height * 0.3, model === 'pickup' ? stats.len * 0.18 : -stats.len * 0.05);
  group.add(cabin);

  if (model === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(stats.wid * 0.9, 0.4, stats.len * 0.4), darkMat);
    bed.position.set(0, stats.height + 0.35, -stats.len * 0.26);
    group.add(bed);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheels = [];
  for (const [wx, wz] of [
    [-stats.wid / 2, stats.len * 0.32],
    [stats.wid / 2, stats.len * 0.32],
    [-stats.wid / 2, -stats.len * 0.32],
    [stats.wid / 2, -stats.len * 0.32],
  ]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    group.add(w);
    wheels.push(w);
  }
  group.userData.wheels = wheels;

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const hx of [-stats.wid * 0.3, stats.wid * 0.3]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.08), headMat);
    h.position.set(hx, stats.height * 0.6 + 0.35, stats.len / 2 + 0.02);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd83a2e });
  for (const hx of [-stats.wid * 0.3, stats.wid * 0.3]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.08), tailMat);
    t.position.set(hx, stats.height * 0.6 + 0.35, -stats.len / 2 - 0.02);
    group.add(t);
  }

  if (model === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2e6fd8 }));
    bar.position.set(0, stats.height + 0.35 + stats.height * 0.72, -stats.len * 0.05);
    group.add(bar);
  }

  group.userData.stats = stats;
  return group;
}

// A drivable car: heading in radians, forward = (sin h, cos h) in x/z.
export class Car {
  constructor(mesh, opts = {}) {
    this.mesh = mesh;
    this.model = opts.model || 'sedan';
    this.name = opts.name || 'Car';
    this.stats = MODEL_STATS[this.model] || MODEL_STATS.sedan;
    this.heading = opts.heading || 0;
    this.speed = 0;
    this.health = 100;
    this.x = opts.x || 0;
    this.z = opts.z || 0;
    this.stolen = false;
    this.isTraffic = !!opts.isTraffic;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  get pos() {
    return { x: this.x, z: this.z };
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // throttle -1..1, steer -1..1, dt seconds. Returns distance moved.
  drive(throttle, steer, dt, colliders) {
    const st = this.stats;
    const prevX = this.x;
    const prevZ = this.z;
    if (throttle > 0) this.speed += st.accel * throttle * dt;
    else if (throttle < 0) this.speed += st.accel * 1.4 * throttle * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    const top = throttle < 0 ? 10 : st.top;
    this.speed = Math.max(-10, Math.min(top, this.speed));
    if (Math.abs(this.speed) > 0.05) {
      const dir = this.speed >= 0 ? 1 : -1;
      this.heading += steer * st.turn * dt * dir * Math.min(1, Math.abs(this.speed) / 8 + 0.25);
    }
    const f = this.forward();
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    this.x = Math.max(-196, Math.min(196, this.x));
    this.z = Math.max(-196, Math.min(196, this.z));
    if (colliders) {
      const hit = this._collide(colliders);
      if (hit) {
        const impact = Math.abs(this.speed);
        if (impact > 8) this.damage(impact * 0.4);
        this.speed *= 0.25;
      }
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    if (this.mesh.userData.wheels) {
      for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 2;
    }
    return Math.hypot(this.x - prevX, this.z - prevZ);
  }

  _collide(colliders) {
    const r = Math.max(this.stats.len, this.stats.wid) / 2;
    for (const box of colliders) {
      const cx = Math.max(box.minX, Math.min(this.x, box.maxX));
      const cz = Math.max(box.minZ, Math.min(this.z, box.maxZ));
      const dx = this.x - cx;
      const dz = this.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        let d = Math.sqrt(d2);
        if (d < 0.001) {
          this.x = box.maxX + r;
          return true;
        }
        const push = r - d;
        this.x += (dx / d) * push;
        this.z += (dz / d) * push;
        return true;
      }
    }
    return false;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }

  repair() {
    this.health = 100;
  }
}
