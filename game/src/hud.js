// HUD: money, wanted stars, clock, district, coins, rank bar, weapon slot,
// car condition, mission panel with timer and par, minimap, toasts, the
// mission result screen and the crosshair. All DOM, no canvas but the map.

import { districtAt, rankForXp } from './config.js';

function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fmtClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.root.innerHTML = `
      <div id="hud-topleft">
        <div id="hud-money">$150</div>
        <div id="hud-wanted"></div>
        <div id="hud-health"><div id="hud-health-fill"></div><span id="hud-health-text">100</span></div>
      </div>
      <div id="hud-topright">
        <div id="hud-clock">17:30</div>
        <div id="hud-district">Downtown</div>
        <div id="hud-coins">☀ COINS 0/10</div>
      </div>
      <div id="hud-mission">
        <div id="hud-mission-name"></div>
        <div id="hud-stage"></div>
        <div id="hud-timer"></div>
        <div id="hud-target"></div>
        <div id="hud-ratings"></div>
      </div>
      <div id="hud-rank"><span id="hud-rank-name">Rookie</span><div id="hud-xpbar"><div id="hud-xp-fill"></div></div></div>
      <div id="hud-minimap-wrap"><canvas id="hud-minimap" width="200" height="200"></canvas><div id="hud-speed"></div></div>
      <div id="hud-car">
        <div id="hud-weapon">✊ FISTS</div>
        <div id="hud-ammo"></div>
        <div id="hud-carname"></div>
        <div id="hud-carcond"></div>
      </div>
      <div id="hud-toasts"></div>
      <div id="hud-crosshair">+</div>
      <div id="hud-hint"></div>
    `;
    this.moneyEl = document.getElementById('hud-money');
    this.wantedEl = document.getElementById('hud-wanted');
    this.healthFill = document.getElementById('hud-health-fill');
    this.healthText = document.getElementById('hud-health-text');
    this.clockEl = document.getElementById('hud-clock');
    this.districtEl = document.getElementById('hud-district');
    this.coinsEl = document.getElementById('hud-coins');
    this.missionNameEl = document.getElementById('hud-mission-name');
    this.stageEl = document.getElementById('hud-stage');
    this.timerEl = document.getElementById('hud-timer');
    this.targetEl = document.getElementById('hud-target');
    this.ratingsEl = document.getElementById('hud-ratings');
    this.rankNameEl = document.getElementById('hud-rank-name');
    this.xpFill = document.getElementById('hud-xp-fill');
    this.map = document.getElementById('hud-minimap');
    this.mapCtx = this.map.getContext('2d');
    this.speedEl = document.getElementById('hud-speed');
    this.weaponEl = document.getElementById('hud-weapon');
    this.ammoEl = document.getElementById('hud-ammo');
    this.carNameEl = document.getElementById('hud-carname');
    this.carCondEl = document.getElementById('hud-carcond');
    this.toastsEl = document.getElementById('hud-toasts');
    this.crosshair = document.getElementById('hud-crosshair');
    this.hintEl = document.getElementById('hud-hint');
    this._toasts = [];
  }

  toast(text, ms = 3200) {
    const el = document.createElement('div');
    el.className = 'hud-toast';
    el.textContent = text;
    this.toastsEl.appendChild(el);
    this._toasts.push(el);
    setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 400);
    }, ms);
  }

  showScreen(name) {
    for (const id of ['screen-title', 'screen-pause', 'screen-result', 'screen-busted', 'screen-wasted']) {
      const el = document.getElementById(id);
      if (el) el.style.display = id === `screen-${name}` ? 'flex' : 'none';
    }
    this.root.style.display = name === 'title' ? 'none' : 'block';
  }

  showResult(result) {
    document.getElementById('result-title').textContent = `${result.name} — COMPLETE`;
    document.getElementById('result-rating').textContent = result.rating;
    document.getElementById('result-rating').className = `rating-${result.rating.toLowerCase()}`;
    document.getElementById('result-time').textContent = `Time ${fmtTime(result.time)}`;
    document.getElementById('result-reward').textContent = `+$${result.reward}  •  +${result.xp} XP`;
    this.showScreen('result');
  }

  update(s) {
    this.moneyEl.textContent = `$${Math.floor(s.money)}`;
    this.wantedEl.textContent = '★'.repeat(s.wanted) + '☆'.repeat(Math.max(0, 5 - s.wanted));
    this.wantedEl.style.color = s.wanted > 0 ? '#ff5040' : '#666';
    this.healthFill.style.width = `${Math.max(0, s.health)}%`;
    this.healthText.textContent = `${Math.ceil(s.health)} HP`;
    this.clockEl.textContent = fmtClock(s.hour);
    this.districtEl.textContent = districtAt(s.x, s.z);
    this.coinsEl.textContent = `☀ COINS ${s.coins}/${s.coinsTotal}`;
    this.missionNameEl.textContent = s.missionName ? `${s.missionId} — ${s.missionName}` : 'Free roam';
    this.stageEl.textContent = s.stageLabel || '';
    this.timerEl.textContent = s.missionActive
      ? `⏱ ${fmtTime(s.missionTime)}  •  GOLD ${fmtTime(s.parGold)}`
      : '';
    this.targetEl.textContent = s.targetDist != null ? `Target ${Math.round(s.targetDist)} m` : '';
    if (s.crewLeft != null && s.crewLeft > 0) {
      this.targetEl.textContent += `  •  Crew left: ${s.crewLeft}`;
    }
    const { rank, next } = rankForXp(s.xp);
    this.rankNameEl.textContent = rank.name;
    const span = next ? next.xp - rank.xp : 100;
    const into = next ? s.xp - rank.xp : span;
    this.xpFill.style.width = `${Math.min(100, (into / span) * 100)}%`;
    this.ratingsEl.textContent = Object.keys(s.ratings).length
      ? 'Ratings: ' + Object.entries(s.ratings).map(([k, v]) => `${k} ${v}`).join('  ')
      : '';
    this.speedEl.textContent = s.inCar ? `${Math.round(s.speedKmh)} km/h` : '';
    this.weaponEl.textContent = s.weapon === 'pistol' ? '🔫 PISTOL' : '✊ FISTS';
    this.ammoEl.textContent = s.weapon === 'pistol' ? `${s.mag} / ${s.reserve}` : '';
    this.carNameEl.textContent = s.inCar ? s.carName : '';
    this.carCondEl.textContent = s.inCar ? `Condition ${Math.round(s.carHealth)}%` : '';
    this.crosshair.style.left = `${s.mouseX}px`;
    this.crosshair.style.top = `${s.mouseY}px`;
    this.crosshair.style.display = s.state === 'playing' ? 'block' : 'none';
    this.hintEl.textContent = s.hint || '';
    this._drawMap(s);
  }

  _drawMap(s) {
    const ctx = this.mapCtx;
    const W = 200;
    const toPx = (v) => ((v + 200) / 400) * W;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#14161c';
    ctx.fillRect(0, 0, W, W);
    // Beach + sea.
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(toPx(166), 0, W - toPx(166), W);
    ctx.fillStyle = '#1e5f8a';
    ctx.fillRect(toPx(196), 0, W - toPx(196), W);
    // Roads.
    ctx.strokeStyle = '#5a5e66';
    ctx.lineWidth = 5;
    for (const c of [-160, -80, 0, 80, 160]) {
      ctx.beginPath(); ctx.moveTo(toPx(c), 0); ctx.lineTo(toPx(c), W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toPx(c)); ctx.lineTo(W, toPx(c)); ctx.stroke();
    }
    const dot = (x, z, color, r = 3) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(toPx(x), toPx(z), r, 0, Math.PI * 2);
      ctx.fill();
    };
    // Coins.
    for (const c of s.coinDots) dot(c.x, c.z, '#ffd94a', 2.5);
    // Traffic (grey) and pedestrians (skip: too noisy).
    for (const t of s.trafficDots) dot(t.x, t.z, '#9a9a9a', 2);
    // Gang (red) and police (blue).
    for (const g of s.gangDots) dot(g.x, g.z, '#ff4040', 3);
    for (const p of s.policeDots) dot(p.x, p.z, '#3a7bff', 3);
    if (s.heliDot) dot(s.heliDot.x, s.heliDot.z, '#ff9040', 4);
    // Mission target: pulsing yellow ring.
    if (s.target) {
      const pulse = 5 + 2 * Math.sin(performance.now() / 250);
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toPx(s.target.x), toPx(s.target.z), pulse, 0, Math.PI * 2);
      ctx.stroke();
      dot(s.target.x, s.target.z, '#ffd94a', 3);
    }
    // Player arrow.
    const px = toPx(s.x);
    const pz = toPx(s.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - s.heading);
    ctx.fillStyle = s.inCar ? '#4aff7a' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
