// The HUD: money, wanted stars, health, speed, the mission objective, a
// message feed, an interaction prompt, the minimap canvas, and the title,
// pause and game-over screens. All DOM; the 3D world never draws text.
import { CITY } from './config.js';

const MAP_W = 180;
const MAP_H = 180;
const MAP_MIN_X = -240;
const MAP_MAX_X = 300;
const MAP_MIN_Z = -240;
const MAP_MAX_Z = 240;

function mapX(x) {
  return ((x - MAP_MIN_X) / (MAP_MAX_X - MAP_MIN_X)) * MAP_W;
}
function mapY(z) {
  return ((z - MAP_MIN_Z) / (MAP_MAX_Z - MAP_MIN_Z)) * MAP_H;
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  const moneyEl = el('money');
  const starsEl = el('stars');
  const healthFill = el('health-fill');
  const speedEl = el('speed');
  const objectiveEl = el('objective');
  const messagesEl = el('messages');
  const promptEl = el('prompt');
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');
  const screens = {
    title: el('screen-title'),
    pause: el('screen-pause'),
    over: el('screen-over'),
  };
  const overTitle = el('over-title');
  const overText = el('over-text');
  const titleStats = el('title-stats');
  const damageEl = el('damage');

  function showOnly(name) {
    Object.entries(screens).forEach(([key, node]) => {
      node.style.display = key === name ? 'flex' : 'none';
    });
    el('hud').style.display = name === 'play' || name === 'pause' ? 'block' : 'none';
  }

  return {
    setMoney(value) {
      moneyEl.textContent = `$${value}`;
    },
    setWanted(stars) {
      let text = '';
      for (let i = 0; i < 5; i += 1) text += i < stars ? '★' : '☆';
      starsEl.textContent = text;
      starsEl.style.color = stars > 0 ? '#ffd23e' : '#8b93a3';
    },
    setHealth(value) {
      healthFill.style.width = `${Math.max(0, Math.min(100, value))}%`;
      healthFill.style.background = value > 50 ? '#58c96b' : value > 25 ? '#f2c94c' : '#e5534b';
    },
    setSpeed(kmh, driving) {
      speedEl.textContent = driving ? `${Math.round(kmh)} km/h` : '';
    },
    setObjective(text) {
      objectiveEl.textContent = text;
    },
    message(text) {
      const div = document.createElement('div');
      div.className = 'message';
      div.textContent = text;
      messagesEl.appendChild(div);
      while (messagesEl.children.length > 3) messagesEl.removeChild(messagesEl.firstChild);
      window.setTimeout(() => {
        if (div.parentNode) div.parentNode.removeChild(div);
      }, 5000);
    },
    prompt(text) {
      promptEl.textContent = text || '';
      promptEl.style.display = text ? 'block' : 'none';
    },
    flashDamage() {
      damageEl.style.opacity = '0.55';
      window.setTimeout(() => {
        damageEl.style.opacity = '0';
      }, 120);
    },
    showTitle(money, missionsDone) {
      titleStats.textContent = `Best cash $${money} · Jobs done ${missionsDone}/3`;
      showOnly('title');
    },
    showPlay() {
      showOnly('play');
    },
    showPause() {
      showOnly('pause');
    },
    showOver(title, text) {
      overTitle.textContent = title;
      overText.textContent = text;
      showOnly('over');
    },
    /** Draw the minimap: roads, sea, mission marker, police, traffic, player. */
    drawMinimap(view, time) {
      const g = mapCtx;
      g.fillStyle = '#10131a';
      g.fillRect(0, 0, MAP_W, MAP_H);
      // Sea and sand on the east edge.
      g.fillStyle = '#1f6f8b';
      g.fillRect(mapX(238), 0, MAP_W - mapX(238), MAP_H);
      g.fillStyle = '#e8cf9a';
      g.fillRect(mapX(200), 0, mapX(238) - mapX(200), MAP_H);
      // Roads.
      g.strokeStyle = '#4a5060';
      g.lineWidth = 5;
      CITY.roads.forEach((c) => {
        g.beginPath();
        g.moveTo(mapX(-200), mapY(c));
        g.lineTo(mapX(200), mapY(c));
        g.stroke();
        g.beginPath();
        g.moveTo(mapX(c), mapY(-200));
        g.lineTo(mapX(c), mapY(200));
        g.stroke();
      });
      g.beginPath();
      g.moveTo(mapX(192), mapY(-200));
      g.lineTo(mapX(192), mapY(200));
      g.stroke();
      // Mission marker, pulsing.
      if (view.missionTarget) {
        const pulse = 5 + Math.sin(time * 5) * 2;
        g.fillStyle = '#f2c94c';
        g.beginPath();
        g.arc(mapX(view.missionTarget.x), mapY(view.missionTarget.z), pulse, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#10131a';
        g.lineWidth = 2;
        g.stroke();
      }
      // Traffic as grey dots, police as flashing red/blue.
      g.fillStyle = '#9aa3b2';
      view.traffic.forEach((car) => {
        g.fillRect(mapX(car.x) - 1.5, mapY(car.z) - 1.5, 3, 3);
      });
      view.police.forEach((car, i) => {
        g.fillStyle = i % 2 === 0 && Math.floor(time * 3) % 2 === 0 ? '#ff2a2a' : '#2a6bff';
        g.beginPath();
        g.arc(mapX(car.x), mapY(car.z), 3.5, 0, Math.PI * 2);
        g.fill();
      });
      // Player arrow, rotated by heading.
      g.save();
      g.translate(mapX(view.player.x), mapY(view.player.z));
      g.rotate(Math.atan2(Math.sin(view.player.heading), -Math.cos(view.player.heading)) + Math.PI);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(4.5, 5);
      g.lineTo(-4.5, 5);
      g.closePath();
      g.fill();
      g.restore();
    },
  };
}
