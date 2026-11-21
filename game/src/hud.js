// The HUD: money, health, wanted stars, speed, the objective line, message
// toasts, a canvas minimap, and the start / pause / busted / wasted screens.
// All of it is plain DOM over the 3D canvas, so it stays sharp at any size.

import { CONFIG } from './config.js';

export class HUD {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = `
      <div id="hud-top-left">
        <div id="hud-money">$150</div>
        <div id="hud-health"><div id="hud-health-fill"></div></div>
      </div>
      <div id="hud-top-right"><div id="hud-stars"></div></div>
      <div id="hud-objective"></div>
      <div id="hud-speed">0 <span>km/h</span></div>
      <canvas id="hud-minimap" width="180" height="180"></canvas>
      <div id="hud-messages"></div>
      <div id="hud-screen" class="hidden"></div>
    `;
    this.moneyEl = root.querySelector('#hud-money');
    this.healthFill = root.querySelector('#hud-health-fill');
    this.starsEl = root.querySelector('#hud-stars');
    this.objectiveEl = root.querySelector('#hud-objective');
    this.speedEl = root.querySelector('#hud-speed');
    this.minimap = root.querySelector('#hud-minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.messagesEl = root.querySelector('#hud-messages');
    this.screenEl = root.querySelector('#hud-screen');
    this.toasts = [];
  }

  setMoney(n) {
    this.moneyEl.textContent = `$${Math.floor(n)}`;
  }

  setHealth(h) {
    const pct = Math.max(0, Math.min(100, h));
    this.healthFill.style.width = `${pct}%`;
    this.healthFill.style.background = pct > 50 ? '#58c96b' : pct > 25 ? '#e8b23a' : '#d95f4b';
  }

  setWanted(level) {
    const full = Math.round(level);
    let stars = '';
    for (let i = 0; i < 5; i += 1) {
      stars += i < full ? '★' : '☆';
    }
    this.starsEl.textContent = stars;
    this.starsEl.style.color = full > 0 ? '#ffd94d' : 'rgba(255,255,255,0.35)';
  }

  setSpeed(kmh) {
    this.speedEl.innerHTML = `${Math.round(kmh)} <span>km/h</span>`;
  }

  setObjective(text) {
    this.objectiveEl.textContent = text;
  }

  toast(text, seconds = 4) {
    const el = document.createElement('div');
    el.className = 'hud-toast';
    el.textContent = text;
    this.messagesEl.appendChild(el);
    const entry = { el, left: seconds };
    this.toasts.push(entry);
    window.setTimeout(() => {
      el.remove();
      const i = this.toasts.indexOf(entry);
      if (i >= 0) this.toasts.splice(i, 1);
    }, seconds * 1000);
  }

  // The minimap: roads, beach, sea, the player, cars, police, walkers and
  // the mission marker, all drawn on a 180x180 canvas.
  drawMinimap(state) {
    const ctx = this.mapCtx;
    const S = 180;
    const half = CONFIG.world.half;
    const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
    ctx.clearRect(0, 0, S, S);
    // Ground and sea.
    ctx.fillStyle = '#20242a';
    ctx.fillRect(0, 0, S, S);
    const [bx] = toMap(CONFIG.world.beachAt, 0);
    ctx.fillStyle = '#e0c188';
    ctx.fillRect(bx, 0, S - bx, S);
    const [sx] = toMap(CONFIG.world.seaAt, 0);
    ctx.fillStyle = '#2a7f8f';
    ctx.fillRect(sx, 0, S - sx, S);
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 5;
    for (const r of CONFIG.world.roads) {
      const [x1, y1] = toMap(r, -half);
      const [x2, y2] = toMap(r, half);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toMap(-half, r);
      const [x4, y4] = toMap(half, r);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }
    // Mission marker.
    if (state.target) {
      const [tx, ty] = toMap(state.target.x, state.target.z);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Walkers, traffic, police.
    const dot = (x, z, color, r) => {
      const [px, py] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const w of state.walkers || []) dot(w.x, w.z, '#c9c9c9', 1.6);
    for (const c of state.traffic || []) dot(c.x, c.z, '#ffffff', 2.2);
    for (const c of state.police || []) dot(c.x, c.z, '#4b8ef7', 2.6);
    // The player, as a triangle pointing where they face.
    const [px, py] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-state.player.heading);
    ctx.fillStyle = '#ff5a4b';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Full-screen overlays: start, pause, busted, wasted. `html` is the inner
  // content; pass null to hide the overlay.
  showScreen(html) {
    if (!html) {
      this.screenEl.classList.add('hidden');
      this.screenEl.innerHTML = '';
      return;
    }
    this.screenEl.classList.remove('hidden');
    this.screenEl.innerHTML = html;
  }

  startScreen() {
    return `
      <div class="screen-card">
        <h1>VICE RUSH</h1>
        <p class="screen-sub">Sunset Bay &mdash; an open-world crime game</p>
        <p>Raka just got off the bus with $150 and one phone number: Mira, the
        fixer who runs this town. Do her jobs, stay ahead of the cops, and make
        the city yours.</p>
        <p class="screen-keys">WASD move &middot; Shift run &middot; E enter car &middot;
        Click punch &middot; Right-click shoot &middot; P pause &middot; M mute</p>
        <button id="start-btn">START ENGINE</button>
        <p class="screen-hint">Headphones on. The city is listening.</p>
      </div>`;
  }

  pauseScreen() {
    return `
      <div class="screen-card">
        <h1>PAUSED</h1>
        <p>Press P or click below to keep driving.</p>
        <button id="resume-btn">RESUME</button>
      </div>`;
  }

  bustedScreen() {
    return `
      <div class="screen-card">
        <h1>BUSTED</h1>
        <p>The Sunset Bay police caught up with you. Mira is not impressed.</p>
        <button id="retry-btn">TRY AGAIN</button>
      </div>`;
  }

  wastedScreen() {
    return `
      <div class="screen-card">
        <h1>WASTED</h1>
        <p>Sunset Bay keeps what it takes. Raka will be back.</p>
        <button id="retry-btn">TRY AGAIN</button>
      </div>`;
  }
}
