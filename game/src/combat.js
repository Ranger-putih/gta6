// Combat: a punch up close and a shot from a distance. Both are simple
// ground-plane tests (no raycaster): the punch hits the nearest person in
// front of the player, the shot hits the first person or car along the aim
// line. Hitting anyone raises the wanted level, because that is what a
// crime is.

import { CONFIG } from './config.js';
import { dist2d, angleTo } from './random.js';

export class Combat {
  constructor() {
    this.punchTimer = 0;
    this.shootTimer = 0;
    // A muzzle flash the renderer draws for a blink after a shot.
    this.flashTimer = 0;
    this.flashAt = { x: 0, z: 0 };
  }

  update(dt) {
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.shootTimer = Math.max(0, this.shootTimer - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
  }

  // Punch the nearest walker or cop in front of the player.
  punch(world) {
    if (this.punchTimer > 0) return false;
    this.punchTimer = CONFIG.combat.punchCooldown;
    const p = world.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const range = CONFIG.combat.punchRange;
    const dmg = CONFIG.combat.punchDamage;

    // Walkers first.
    for (const w of world.pedestrians.walkers) {
      if (w.down) continue;
      const dx = w.x - p.x;
      const dz = w.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < range && dx * fx + dz * fz > 0) {
        w.health -= dmg;
        if (w.health <= 0) {
          w.down = true;
          w.downTimer = 3;
          world.police.addWanted(CONFIG.wanted.hitPedestrian);
          world.toast('You knocked someone out. The cops noticed.');
        }
        world.audio.punch();
        return true;
      }
    }
    // Then the police on foot (there are none on foot in this build, but a
    // punch at a cruiser still counts as hitting the law).
    for (const car of world.police.cars) {
      const d = dist2d(p.x, p.z, car.x, car.z);
      if (d < range + 1.2) {
        world.police.addWanted(CONFIG.wanted.punchCop);
        world.toast('You hit a police car. Bad idea.');
        world.audio.punch();
        return true;
      }
    }
    world.audio.punch();
    return false;
  }

  // Shoot along the player's aim (the camera's forward on the ground).
  // Returns true when something was hit.
  shoot(world) {
    if (this.shootTimer > 0) return false;
    this.shootTimer = CONFIG.combat.shootCooldown;
    const p = world.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const range = CONFIG.combat.shootRange;
    const dmg = CONFIG.combat.shootDamage;
    world.audio.shoot();
    this.flashTimer = 0.09;
    this.flashAt = { x: p.x + fx * 1.6, z: p.z + fz * 1.6 };

    // The nearest thing along the aim line, walkers and police cars alike.
    let best = null;
    let bestD = range;
    const consider = (x, z, radius, kind, ref) => {
      const dx = x - p.x;
      const dz = z - p.z;
      const along = dx * fx + dz * fz;
      if (along <= 0 || along > bestD) return;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < radius + 0.6) {
        best = { kind, ref, along };
        bestD = along;
      }
    };
    for (const w of world.pedestrians.walkers) {
      if (!w.down) consider(w.x, w.z, 0.6, 'ped', w);
    }
    for (const car of world.police.cars) {
      consider(car.x, car.z, 1.8, 'cop', car);
    }
    if (!best) return false;

    if (best.kind === 'ped') {
      best.ref.health -= dmg;
      if (best.ref.health <= 0) {
        best.ref.down = true;
        best.ref.downTimer = 3;
      }
      world.police.addWanted(CONFIG.wanted.hitPedestrian);
    } else {
      best.ref.health = (best.ref.health || CONFIG.combat.copHealth) - dmg;
      if (best.ref.health <= 0) {
        world.police.removeCar(best.ref);
      }
      world.police.addWanted(CONFIG.wanted.shoot);
    }
    return true;
  }
}
