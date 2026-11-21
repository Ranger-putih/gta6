// Missions for Vice Rush. Five jobs, chained in order, each a chain of
// named stages: the HUD shows STAGE n/N so the player always knows
// where they stand. A stage is one verb — reach a point, steal a car,
// deliver it, race checkpoints on a timer, take out a gang, lose the
// cops — and every target sits on open ground, never inside a building.

import { MISSIONS } from './config.js';
import { audio } from './audio.js';

function dist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export class Missions {
  constructor(world) {
    this.world = world;
    this.index = 0;
    this.stage = 0;
    this.done = [];
    this.active = false;
    this.timer = 0;
    this.raceCp = 0;
    this.eliminated = 0;
    this.rating = null;
    this.gangSpawned = false;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get currentStage() {
    const m = this.current;
    return m ? m.stages[this.stage] : null;
  }

  get stageCount() {
    const m = this.current;
    return m ? m.stages.length : 0;
  }

  start() {
    this.active = true;
    this.index = 0;
    this.stage = 0;
    this.done = [];
    this.beginStage();
  }

  // Restore progress from a save: skip the missions already done.
  restore(doneIds) {
    this.done = (doneIds || []).slice();
    let i = 0;
    while (i < MISSIONS.length && this.done.includes(MISSIONS[i].id)) i++;
    this.index = Math.min(i, MISSIONS.length - 1);
    this.stage = 0;
    this.active = this.index < MISSIONS.length;
    if (this.active) this.beginStage();
  }

  // Side effects when a stage begins: spawn the gang, light the wanted
  // level for an escape, start the race clock, and make sure the car a
  // delivery needs is still drivable.
  beginStage() {
    const m = this.current;
    const s = this.currentStage;
    if (!m || !s) return;
    if (s.type === 'deliver') {
      // The sports car is Mira's prize: it cannot arrive wrecked.
      this.world.sportsCar.repair();
    }
    if (s.type === 'race') {
      this.timer = 0;
      this.raceCp = 0;
      this.rating = null;
    }
    if (s.type === 'eliminate') {
      this.eliminated = 0;
      this.world.pedestrians.spawnGang();
      this.gangSpawned = true;
    }
    if (s.type === 'escape') {
      // An escape only works if there is heat to lose.
      const heat = m.id === 'escape' ? 3 : 2;
      this.world.police.setWanted(heat);
      this.world.hud.toast('The cops are onto you — lose them!');
    }
  }

  // Called by combat when a gang member goes down.
  onGangDown() {
    if (!this.active) return;
    const s = this.currentStage;
    if (s && s.type === 'eliminate') {
      this.eliminated += 1;
      this.world.hud.toast(`Gang down — ${this.eliminated}/${s.count}`);
    }
  }

  update(dt) {
    if (!this.active) return;
    const m = this.current;
    const s = this.currentStage;
    if (!m || !s) return;
    const p = this.world.player;

    if (s.type === 'goto') {
      if (dist(p.x, p.z, s.x, s.z) < s.radius) this.completeStage();
    } else if (s.type === 'steal') {
      if (p.car === this.world.sportsCar) this.completeStage();
    } else if (s.type === 'deliver') {
      if (p.car === this.world.sportsCar && dist(p.x, p.z, s.x, s.z) < s.radius) this.completeStage();
    } else if (s.type === 'race') {
      this.timer += dt;
      const cp = s.checkpoints[this.raceCp];
      if (cp && dist(p.x, p.z, cp.x, cp.z) < 10) {
        this.raceCp += 1;
        audio.checkpoint();
        this.world.hud.toast(`CHECKPOINT ${this.raceCp}/${s.checkpoints.length}`);
        if (this.raceCp >= s.checkpoints.length) this.completeStage();
      }
    } else if (s.type === 'eliminate') {
      if (this.eliminated >= s.count) this.completeStage();
    } else if (s.type === 'escape') {
      if (this.world.police.wanted <= 0) this.completeStage();
    }
  }

  completeStage() {
    const m = this.current;
    const s = this.currentStage;
    audio.pickup();
    this.stage += 1;
    if (this.stage >= m.stages.length) {
      this.completeMission();
      return;
    }
    const next = this.currentStage;
    this.world.hud.toast(`STAGE ${this.stage + 1}/${m.stages.length} — ${next.name}`);
    this.beginStage();
  }

  completeMission() {
    const m = this.current;
    this.world.addMoney(m.reward);
    this.world.addXp(m.xp);
    this.world.combat.addAmmo(24);
    let extra = '';
    if (m.id === 'sprint') {
      const t = this.timer;
      this.rating = t <= m.stages[1].gold ? 'GOLD' : t <= m.stages[1].silver ? 'SILVER' : 'BRONZE';
      extra = ` — ${this.rating} in ${t.toFixed(1)}s`;
    }
    this.done.push(m.id);
    audio.missionDone();
    this.world.hud.toast(`Job done: ${m.name} — +$${m.reward}${extra}`);
    this.world.save();
    this.index += 1;
    this.stage = 0;
    if (this.index >= MISSIONS.length) {
      this.active = false;
      this.world.hud.toast('All jobs done — Sunset Bay is yours, Raka.');
      return;
    }
    const next = this.current;
    this.world.hud.toast(`NEW JOB: ${next.name} — ${next.brief}`);
    this.beginStage();
  }

  // The point the minimap beacon and the world marker aim at, or null
  // when the current stage has no single point (an escape).
  targetPos() {
    const s = this.currentStage;
    if (!s) return null;
    if (s.type === 'goto' || s.type === 'deliver') return { x: s.x, z: s.z };
    if (s.type === 'steal') return { x: this.world.sportsCar.x, z: this.world.sportsCar.z };
    if (s.type === 'race') return s.checkpoints[this.raceCp] || null;
    if (s.type === 'eliminate') return { x: s.area.x, z: s.area.z };
    return null;
  }

  // Everything the HUD needs in one object.
  status() {
    const m = this.current;
    const s = this.currentStage;
    if (!m || !s) return { done: true, text: 'All jobs done' };
    let text = s.name;
    if (s.type === 'race') text += ` — CP ${this.raceCp}/${s.checkpoints.length} — ${this.timer.toFixed(1)}s`;
    if (s.type === 'eliminate') text += ` — ${this.eliminated}/${s.count} down`;
    if (s.type === 'escape') text += ' — stay clean until the stars fade';
    return {
      done: false,
      missionName: m.name,
      stage: this.stage + 1,
      stageCount: m.stages.length,
      stageName: s.name,
      text,
      target: this.targetPos(),
    };
  }
}
