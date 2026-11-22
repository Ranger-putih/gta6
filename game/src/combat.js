// Combat: fists and a pistol with a magazine, fired through the mouse aim
// ray. Hits are tested against pedestrians, crew and foot cops.

import * as THREE from 'three';

export class Combat {
  constructor() {
    this.weapon = 'fists'; // 'fists' | 'pistol'
    this.mag = 12;
    this.magSize = 12;
    this.reserve = 24;
    this.punchCd = 0;
    this.shootCd = 0;
    this.flash = 0;
    this.lastShotAt = 0;
  }

  switchWeapon(name) {
    if (name === '1') this.weapon = 'fists';
    if (name === '2') this.weapon = 'pistol';
  }

  reload() {
    if (this.weapon !== 'pistol' || this.mag === this.magSize || this.reserve <= 0) return false;
    const need = this.magSize - this.mag;
    const take = Math.min(need, this.reserve);
    this.mag += take;
    this.reserve -= take;
    return true;
  }

  addAmmo(n) {
    this.reserve += n;
  }

  update(dt) {
    this.punchCd = Math.max(0, this.punchCd - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.flash = Math.max(0, this.flash - dt * 6);
  }

  // Aim ray from the camera through the mouse position (NDC -1..1).
  aimRay(camera, mouseX, mouseY) {
    const ndcX = (mouseX / window.innerWidth) * 2 - 1;
    const ndcY = -(mouseY / window.innerHeight) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: ndcX, y: ndcY }, camera);
    return ray.ray;
  }

  // Fire the current weapon. Returns a hit report or null.
  fire(camera, mouseX, mouseY, pedestrians, police, playerPos) {
    if (this.weapon === 'fists') return this._punch(pedestrians, police, playerPos);
    return this._shoot(camera, mouseX, mouseY, pedestrians, police);
  }

  _punch(pedestrians, police, playerPos) {
    if (this.punchCd > 0) return null;
    this.punchCd = 0.4;
    const all = [...pedestrians.walkers, ...pedestrians.crew, ...police.cops.map((c) => ({ ...c, kind: 'cop' }))];
    let best = null;
    let bestD = 2.4;
    for (const p of all) {
      if (p.alive === false) continue;
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (d < bestD) { best = p; bestD = d; }
    }
    if (!best) return { kind: 'miss', weapon: 'fists' };
    if (best.kind === 'cop') {
      best.mesh.visible = false;
      police.cops = police.cops.filter((c) => c !== best);
      return { kind: 'cop-down', weapon: 'fists' };
    }
    pedestrians.kill(best);
    return { kind: best.kind === 'gang' ? 'gang-down' : 'ped-down', weapon: 'fists', target: best };
  }

  _shoot(camera, mouseX, mouseY, pedestrians, police) {
    if (this.shootCd > 0) return null;
    if (this.mag <= 0) {
      this.reload();
      return { kind: 'empty', weapon: 'pistol' };
    }
    this.shootCd = 0.22;
    this.mag -= 1;
    this.flash = 1;
    this.lastShotAt = performance.now();
    const ray = this.aimRay(camera, mouseX, mouseY);
    const origin = { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z };
    const dir = { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z };
    const hit = pedestrians.rayHit(origin, dir, 45);
    if (hit) {
      hit.hp -= 50;
      if (hit.hp <= 0) {
        pedestrians.kill(hit);
        return { kind: hit.kind === 'gang' ? 'gang-down' : 'ped-down', weapon: 'pistol', target: hit };
      }
      return { kind: 'hit', weapon: 'pistol', target: hit };
    }
    // Foot cops can be shot too: test the same ray against their positions.
    for (const cop of police.cops) {
      const cx = cop.x - origin.x;
      const cy = 1.2 - origin.y;
      const cz = cop.z - origin.z;
      const along = cx * dir.x + cy * dir.y + cz * dir.z;
      if (along < 0 || along > 45) continue;
      const mx = cx - dir.x * along;
      const my = cy - dir.y * along;
      const mz = cz - dir.z * along;
      if (Math.sqrt(mx * mx + my * my + mz * mz) < 1.3) {
        cop.mesh.visible = false;
        police.cops = police.cops.filter((c) => c !== cop);
        return { kind: 'cop-down', weapon: 'pistol' };
      }
    }
    return { kind: 'miss', weapon: 'pistol' };
  }
}
