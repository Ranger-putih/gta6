// Cars for Vice Rush. Every vehicle is a few boxes and cylinders, so the
// whole fleet costs almost nothing to draw. A car is a model (its shape
// and speed), a mesh, and a little physics: accelerate, brake, steer,
// and slide along building walls instead of sinking into them.
// Forward is (sin(heading), cos(heading)): heading PI faces north.

import * as THREE from 'three';
import { CAR_MODELS } from './config.js';

function box(w, h, d, color, x, y, z, emissive) {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (emissive) mat.emissive = new THREE.Color(emissive);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = false;
  return m;
}

function wheel(x, z) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  m.rotation.z = Math.PI / 2;
  m.position.set(x, 0.36, z);
  return m;
}

// Build the visible mesh for a model. The sports car is long and low,
// the van is a tall box, the pickup has an open bed, the taxi wears a
// roof sign, the bike is a narrow frame with two wheels, and the police
// cruiser carries a light bar.
export function buildCarMesh(modelKey) {
  const model = CAR_MODELS[modelKey] || CAR_MODELS.sedan;
  const g = new THREE.Group();
  const c = model.color;

  if (modelKey === 'bike') {
    g.add(box(0.5, 0.5, 1.9, c, 0, 0.75, 0));
    g.add(box(0.4, 0.35, 0.5, 0x333333, 0, 1.05, -0.3));
    const w1 = wheel(0, 0.75);
    const w2 = wheel(0, -0.75);
    w1.scale.set(1, 1, 0.6);
    w2.scale.set(1, 1, 0.6);
    g.add(w1, w2);
    g.add(box(0.1, 0.1, 0.7, 0x888888, 0, 1.1, 0.6));
    return g;
  }

  const long = modelKey === 'sports' ? 4.6 : modelKey === 'van' ? 4.4 : 4.2;
  const wide = modelKey === 'van' ? 2.1 : 1.9;
  const low = modelKey === 'sports' ? 0.55 : 0.75;
  g.add(box(wide, low, long, c, 0, 0.65, 0));
  if (modelKey === 'van') {
    g.add(box(wide - 0.2, 0.9, long - 1.2, 0xdfe6ee, 0, 1.5, -0.2));
  } else if (modelKey === 'pickup') {
    g.add(box(wide - 0.2, 0.55, 1.6, 0x222222, 0, 0.95, -1.0));
    g.add(box(wide - 0.3, 0.6, 1.2, c, 0, 1.15, 0.9));
  } else {
    g.add(box(wide - 0.3, 0.55, long * 0.45, 0x1a2a3a, 0, 1.15, -0.2));
  }
  if (modelKey === 'taxi') {
    g.add(box(0.7, 0.18, 0.4, 0xffd400, 0, 1.55, -0.2, 0x664400));
  }
  if (modelKey === 'police') {
    g.add(box(1.2, 0.14, 0.5, 0xffffff, 0, 1.5, -0.2));
    g.add(box(0.5, 0.12, 0.3, 0xff2222, -0.35, 1.62, -0.2, 0xff2222));
    g.add(box(0.5, 0.12, 0.3, 0x2244ff, 0.35, 1.62, -0.2, 0x2244ff));
  }
  g.add(box(0.3, 0.18, 0.1, 0xfff2b0, -0.6, 0.7, long / 2, 0xaa8800));
  g.add(box(0.3, 0.18, 0.1, 0xfff2b0, 0.6, 0.7, long / 2, 0xaa8800));
  g.add(box(0.25, 0.15, 0.08, 0xff2222, -0.6, 0.7, -long / 2, 0x550000));
  g.add(box(0.25, 0.15, 0.08, 0xff2222, 0.6, 0.7, -long / 2, 0x550000));
  g.add(wheel(-wide / 2, long * 0.32));
  g.add(wheel(wide / 2, long * 0.32));
  g.add(wheel(-wide / 2, -long * 0.32));
  g.add(wheel(wide / 2, -long * 0.32));
  return g;
}

export class Car {
  constructor(modelKey, x, z, heading) {
    this.modelKey = modelKey;
    this.model = CAR_MODELS[modelKey] || CAR_MODELS.sedan;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.health = 100;
    this.parked = false;
    this.traffic = false;
    this.driver = null;
    this.mesh = buildCarMesh(modelKey);
    this.syncMesh();
  }

  get forwardX() {
    return Math.sin(this.heading);
  }
  get forwardZ() {
    return Math.cos(this.heading);
  }

  get condition() {
    return Math.max(0, Math.round(this.health));
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  // One physics step. throttle in [-1, 1], steer in [-1, 1]. collide is
  // a function (x, z, radius) that answers whether a spot is blocked.
  drive(dt, throttle, steer, collide) {
    const m = this.model;
    if (throttle > 0) this.speed += m.accel * throttle * dt;
    else if (throttle < 0) this.speed += (this.speed > 0.5 ? -30 : -8) * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    if (this.speed > m.top) this.speed = m.top;
    if (this.speed < -10) this.speed = -10;
    // Steering bites less the faster the car goes.
    const steerRate = 1.9 * m.grip * Math.max(0.35, 1 - Math.abs(this.speed) / (m.top * 1.6));
    // D decreases the heading (the car veers east when facing north).
    this.heading -= steer * steerRate * dt * Math.sign(this.speed || 1);
    const nx = this.x + this.forwardX * this.speed * dt;
    const nz = this.z + this.forwardZ * this.speed * dt;
    const r = this.modelKey === 'bike' ? 0.9 : 1.4;
    if (collide && collide(nx, nz, r)) {
      // A wall: stop, take a little damage, and slide along it.
      if (Math.abs(this.speed) > 6) this.health = Math.max(0, this.health - Math.abs(this.speed) * 0.35);
      this.speed *= 0.4;
    } else {
      this.x = nx;
      this.z = nz;
    }
    this.syncMesh();
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  repair() {
    this.health = 100;
  }
}
