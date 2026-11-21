// Combat for Vice Rush. Fists for up close, a pistol for everything
// else. A shot is a ray from the player toward the crosshair: the first
// living person inside a narrow cone takes the hit. Hurting a civilian
// is a crime; taking out a gang member is the Night Market mission.

import { WEAPONS, MAX_AMMO } from './config.js';
import { audio } from './audio.js';

export class Combat {
  constructor() {
    this.weaponKey = 'fists';
    this.ammo = WEAPONS.pistol.ammo;
    this.cooldown = 0;
  }

  get weapon() {
    return WEAPONS[this.weaponKey];
  }

  switchWeapon(key) {
    if (WEAPONS[key]) {
      this.weaponKey = key;
      audio.click();
      return true;
    }
    return false;
  }

  addAmmo(n) {
    this.ammo = Math.min(MAX_AMMO, this.ammo + n);
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
  }

  // The nearest living person inside a cone in front of the player.
  // dirX/dirZ is the facing direction, maxDist the reach.
  static nearestInCone(people, px, pz, dirX, dirZ, maxDist, coneCos) {
    let best = null;
    let bestD = Infinity;
    for (const p of people) {
      if (!p.alive) continue;
      const dx = p.x - px;
      const dz = p.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > maxDist || d < 0.01) continue;
      const cos = (dx * dirX + dz * dirZ) / d;
      if (cos < coneCos) continue;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  // A punch: short reach, no ammo, a thud and a fallen pedestrian.
  // Returns the person hit, or null.
  punch(world) {
    if (this.cooldown > 0) return null;
    this.cooldown = WEAPONS.fists.rate;
    audio.punch();
    const p = world.player;
    const dirX = Math.sin(p.heading);
    const dirZ = Math.cos(p.heading);
    const people = [...world.pedestrians.walkers, ...world.pedestrians.gang, ...world.police.officers];
    const hit = Combat.nearestInCone(people, p.x, p.z, dirX, dirZ, WEAPONS.fists.range, 0.5);
    if (!hit) return null;
    this.applyHit(world, hit, WEAPONS.fists.damage);
    return hit;
  }

  // A shot: long reach, eats one round, a crack and a muzzle blink.
  // Returns the person hit, or null. No ammo means a dry click.
  shoot(world) {
    if (this.cooldown > 0) return null;
    if (this.weaponKey !== 'pistol') return this.punch(world);
    if (this.ammo <= 0) {
      this.cooldown = 0.3;
      audio.click();
      world.hud.toast('NO AMMO — finish a mission to restock');
      return null;
    }
    this.cooldown = this.weapon.rate;
    this.ammo -= 1;
    audio.shoot();
    const p = world.player;
    const dirX = Math.sin(p.heading);
    const dirZ = Math.cos(p.heading);
    const people = [...world.pedestrians.walkers, ...world.pedestrians.gang, ...world.police.officers];
    const hit = Combat.nearestInCone(people, p.x, p.z, dirX, dirZ, WEAPONS.pistol.range, 0.94);
    if (!hit) return null;
    this.applyHit(world, hit, WEAPONS.pistol.damage);
    return hit;
  }

  // Resolve a hit: gang members count for the mission, everyone else is
  // a crime the police notice.
  applyHit(world, person, damage) {
    void damage;
    const isGang = world.pedestrians.gang.includes(person);
    const isOfficer = world.police.officers.includes(person);
    if (isGang) {
      const wasGang = world.pedestrians.eliminate(person);
      audio.hit();
      if (wasGang) {
        world.missions.onGangDown();
        world.addXp(25);
      }
      return;
    }
    // A civilian or an officer goes down; the city notices.
    world.pedestrians.knockDown(person);
    if (isOfficer) {
      person.alive = false;
      world.police.addWanted(2);
      world.hud.toast('You took down an officer — 2 stars');
    } else {
      world.police.addWanted(1);
      world.hud.toast('A pedestrian is down — the cops noticed');
    }
    audio.hit();
  }
}
