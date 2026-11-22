// Missions: five staged jobs with par times, gold/silver/bronze ratings and
// a result screen. Stage types: goto, steal, deliver, race, eliminate, escape.
//
// Ordering rule (a bug from the first round-6 attempt): an escape stage
// applies its wanted level when the stage STARTS, before any completion
// check can run, and the world updates the police (wanted decay) before it
// updates missions — so the stage can never complete in the same instant
// its heat is applied.

import { MISSIONS, ratingForTime } from './config.js';

export class Missions {
  constructor(hooks) {
    this.hooks = hooks || {};
    this.current = 0;
    this.stageIndex = 0;
    this.startTime = 0;
    this.heatSeen = false;
    this.checkpointIndex = 0;
    this.done = [];
    this.ratings = {};
    this.result = null;
    this.started = false;
  }

  mission() {
    return MISSIONS[this.current];
  }

  missionTime(gameTime) {
    return this.started ? Math.max(0, gameTime - this.startTime) : 0;
  }

  startMission(index, gameTime, police) {
    this.current = index;
    this.stageIndex = 0;
    this.checkpointIndex = 0;
    this.startTime = gameTime;
    this.started = true;
    this.result = null;
    this._enterStage(police);
    if (this.hooks.onMissionStart) this.hooks.onMissionStart(this.mission());
  }

  _enterStage(police) {
    const stage = this.mission().stages[this.stageIndex];
    this.heatSeen = false;
    if (stage.type === 'escape') {
      // Apply the heat FIRST, then the stage can only end once the police
      // decay has brought wanted back to zero in a later frame.
      if (police && police.wantedCount() < 2) police.setWanted(2);
      this.heatSeen = true;
    }
    if (stage.type === 'race') this.checkpointIndex = 0;
  }

  stage() {
    return this.mission().stages[this.stageIndex];
  }

  stageCount() {
    return this.mission().stages.length;
  }

  stageLabel() {
    const m = this.mission();
    const s = this.stage();
    let extra = '';
    if (s.type === 'race') extra = ` ${this.checkpointIndex + 1}/${s.checkpoints.length}`;
    return `STAGE ${this.stageIndex + 1}/${m.stages.length}${extra} — ${s.label}`;
  }

  // Where the player should go next, for the HUD, minimap and autopilot.
  target() {
    const s = this.stage();
    if (s.type === 'goto' || s.type === 'steal' || s.type === 'deliver') {
      return { x: s.x, z: s.z, radius: s.radius || 8 };
    }
    if (s.type === 'race') {
      const cp = s.checkpoints[this.checkpointIndex];
      return { x: cp[0], z: cp[1], radius: s.radius || 8 };
    }
    if (s.type === 'eliminate') return { x: s.x, z: s.z, radius: 30 };
    return null;
  }

  update(gameTime, ctx) {
    if (!this.started || this.result) return;
    const s = this.stage();
    const d = (x, z) => Math.hypot(ctx.x - x, ctx.z - z);
    let done = false;
    if (s.type === 'goto') {
      done = d(s.x, s.z) < (s.radius || 8);
    } else if (s.type === 'steal') {
      done = !!ctx.inCar && ctx.carName === 'Gold Sports';
    } else if (s.type === 'deliver') {
      done = !!ctx.inCar && ctx.carName === 'Gold Sports' && d(s.x, s.z) < (s.radius || 9);
    } else if (s.type === 'race') {
      const cp = s.checkpoints[this.checkpointIndex];
      if (d(cp[0], cp[1]) < (s.radius || 8)) {
        this.checkpointIndex += 1;
        if (this.hooks.onCheckpoint) this.hooks.onCheckpoint(this.checkpointIndex, s.checkpoints.length);
        if (this.checkpointIndex >= s.checkpoints.length) done = true;
      }
    } else if (s.type === 'eliminate') {
      done = ctx.crewLeft === 0;
    } else if (s.type === 'escape') {
      // Heat was applied at stage start; the police update already ran
      // this frame, so wanted==0 here means the player truly lost them.
      done = this.heatSeen && ctx.wanted === 0;
    }
    if (done) this._advance(gameTime, ctx);
  }

  _advance(gameTime, ctx) {
    const m = this.mission();
    if (this.stageIndex + 1 < m.stages.length) {
      this.stageIndex += 1;
      this._enterStage(ctx.police);
      if (this.hooks.onStageComplete) this.hooks.onStageComplete(this.stage());
      return;
    }
    const seconds = this.missionTime(gameTime);
    const rating = ratingForTime(seconds, m);
    this.done.push(m.id);
    this.ratings[m.id] = rating;
    this.result = {
      id: m.id,
      name: m.name,
      time: seconds,
      rating,
      reward: m.reward,
      xp: m.xp,
    };
    this.started = false;
    if (this.hooks.onMissionComplete) this.hooks.onMissionComplete(this.result);
  }

  // Called by the world after the result screen is dismissed.
  nextMission(gameTime, police) {
    this.result = null;
    if (this.current + 1 < MISSIONS.length) {
      this.startMission(this.current + 1, gameTime, police);
      return true;
    }
    return false;
  }
}
