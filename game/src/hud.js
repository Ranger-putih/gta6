// The HUD for Vice Rush: money and wanted stars, health, a canvas
// minimap, the mission objective with its STAGE n/N, and the new
// polish — a weapon slot with ammo, a rank bar, the district name, the
// car's condition, and the in-game clock. All of it is DOM plus one
// canvas; the 3D world never draws a pixel of interface.

import { ROADS, CITY_HALF } from './config.js';

function el(id) {
  return document.getElementById(id);
}

export class Hud {
  constructor() {
    this.money = el('money');
    this.wanted = el('wanted');
    this.rank = el('rank');
    this.rankFill = el('rankfill');
    this.clock = el('clock');
    this.district = el('district');
    this.health = el('health');
    this.healthFill = el('healthfill');
    this.weapon = el('weapon');
    this.ammo = el('ammo');
    this.speed = el('speed');
    this.carcond = el('carcond');
    this.carname = el('carname');
    this.objective = el('objective');
    this.toasts = el('toasts');
    this.map = el('minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    this.toastQueue = [];
  }

  toast(msg) {
    if (!this.toasts) return;
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    this.toasts.appendChild(div);
    while (this.toasts.children.length > 4) this.toasts.removeChild(this.toasts.firstChild);
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 4500);
  }

  showScreen(name) {
    for (const id of ['screen-start', 'screen-pause', 'screen-busted', 'screen-wasted']) {
      const s = el(id);
      if (s) s.style.display = id === 'screen-' + name ? 'flex' : 'none';
    }
  }

  update(world, dt) {
    void dt;
    const p = world.player;
    if (this.money) this.money.textContent = '$' + world.money;
    if (this.wanted) {
      this.wanted.textContent = '★'.repeat(world.police.wanted) || '—';
      this.wanted.style.color = world.police.wanted >= 4 ? '#ff4444' : '#ffd94d';
    }
    if (this.clock) this.clock.textContent = world.clockText;
    if (this.district) this.district.textContent = world.district;
    const rank = world.rank;
    if (this.rank) this.rank.textContent = rank.rank.name;
    if (this.rankFill) {
      if (rank.next) {
        const span = rank.next.xp - rank.rank.xp;
        const done = world.xp - rank.rank.xp;
        this.rankFill.style.width = Math.max(0, Math.min(100, (done / span) * 100)) + '%';
      } else {
        this.rankFill.style.width = '100%';
      }
    }
    if (this.health) this.health.textContent = Math.round(p.health);
    if (this.healthFill) {
      this.healthFill.style.width = Math.max(0, p.health) + '%';
      this.healthFill.style.background = p.health > 50 ? '#4caf50' : p.health > 25 ? '#ff9800' : '#f44336';
    }
    const w = world.combat.weapon;
    if (this.weapon) this.weapon.textContent = w.name;
    if (this.ammo) this.ammo.textContent = w.ammo === Infinity ? '∞' : String(world.combat.ammo);
    if (this.speed) {
      const kmh = Math.round(Math.abs(p.speed || 0) * 3.6);
      this.speed.textContent = p.onFoot ? '' : String(kmh);
    }
    if (this.carname) this.carname.textContent = p.car ? p.car.model.name.toUpperCase() : '';
    if (this.carcond) {
      this.carcond.textContent = p.car ? `COND ${p.car.condition}%` : '';
      this.carcond.style.color = p.car && p.car.condition < 35 ? '#ff4444' : '#e8e8e8';
    }
    const st = world.missions.status();
    if (this.objective) {
      if (st.done) {
        this.objective.innerHTML = '<b>ALL JOBS DONE</b><br>Sunset Bay is yours.';
      } else {
        this.objective.innerHTML =
          `<b>${st.missionName}</b> &nbsp; STAGE ${st.stage}/${st.stageCount}<br>${st.text}`;
      }
    }
    this.drawMinimap(world);
  }

  drawMinimap(world) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const S = 220;
    const scale = S / (CITY_HALF * 2 + 90);
    const toX = (x) => S / 2 + x * scale;
    const toY = (z) => S / 2 + z * scale;
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, S, S);
    // Sea and beach on the east.
    ctx.fillStyle = '#1c4a6e';
    ctx.fillRect(toX(200), 0, S - toX(200), S);
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(toX(200), 0, toX(240) - toX(200), S);
    // Roads.
    ctx.strokeStyle = '#3a3a42';
    ctx.lineWidth = 5;
    for (const r of ROADS) {
      ctx.beginPath();
      ctx.moveTo(toX(r), toY(-CITY_HALF));
      ctx.lineTo(toX(r), toY(CITY_HALF));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(-CITY_HALF), toY(r));
      ctx.lineTo(toX(CITY_HALF), toY(r));
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#565664';
    for (const b of world.city.buildings) {
      ctx.fillRect(toX(b.x - b.w / 2), toY(b.z - b.d / 2), b.w * scale, b.d * scale);
    }
    // Race checkpoints, if the race is running.
    const st = world.missions.status();
    const stage = world.missions.currentStage;
    if (stage && stage.type === 'race') {
      ctx.fillStyle = '#ffd94d';
      stage.checkpoints.forEach((cp, i) => {
        if (i < world.missions.raceCp) return;
        ctx.beginPath();
        ctx.arc(toX(cp.x), toY(cp.z), i === world.missions.raceCp ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // Gang members, red.
    ctx.fillStyle = '#ff4444';
    for (const m of world.pedestrians.gang) {
      if (!m.alive) continue;
      ctx.fillRect(toX(m.x) - 2, toY(m.z) - 2, 4, 4);
    }
    // Police, blue.
    ctx.fillStyle = '#4f9fd9';
    for (const c of world.police.cars) {
      ctx.beginPath();
      ctx.arc(toX(c.x), toY(c.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission target, a yellow diamond.
    const t = world.missions.targetPos();
    if (t) {
      const x = toX(t.x);
      const y = toY(t.z);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
    }
    // The player, a white arrow that turns with them.
    const p = world.player;
    ctx.save();
    ctx.translate(toX(p.x), toY(p.z));
    ctx.rotate(Math.PI - p.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
