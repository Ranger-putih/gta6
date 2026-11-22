// Render: the day-night cycle. Sky, fog, sun and ambient light are lerped
// through the keyframes in config.js; street lamps switch on after dark.

import * as THREE from 'three';
import { DAY_KEYS } from './config.js';

function lerpColor(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

export function dayColors(hour) {
  const h = ((hour % 24) + 24) % 24;
  let prev = DAY_KEYS[0];
  let next = DAY_KEYS[DAY_KEYS.length - 1];
  for (let i = 0; i < DAY_KEYS.length - 1; i++) {
    if (h >= DAY_KEYS[i].h && h <= DAY_KEYS[i + 1].h) {
      prev = DAY_KEYS[i];
      next = DAY_KEYS[i + 1];
      break;
    }
  }
  const span = Math.max(0.001, next.h - prev.h);
  const t = Math.max(0, Math.min(1, (h - prev.h) / span));
  return {
    sky: lerpColor(prev.sky, next.sky, t),
    fog: lerpColor(prev.fog, next.fog, t),
    sun: lerpColor(prev.sun, next.sun, t),
    sunI: prev.sunI + (next.sunI - prev.sunI) * t,
    hemi: prev.hemi + (next.hemi - prev.hemi) * t,
    night: 1 - Math.max(0, Math.min(1, (prev.sunI + (next.sunI - prev.sunI) * t - 0.15) / 0.9)),
  };
}

export class Render {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.position.set(120, 180, 60);
    scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a2f28, 0.6);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0x87b5e0, 120, 420);
    this._setNight = null;
  }

  bindCity(city) {
    this._setNight = city.setNight;
  }

  update(hour) {
    const c = dayColors(hour);
    this.scene.background = c.sky;
    this.scene.fog.color.copy(c.fog);
    this.sun.color.copy(c.sun);
    this.sun.intensity = c.sunI;
    this.hemi.intensity = c.hemi;
    // Sun swings east to west through the day; low and orange at dusk.
    const ang = ((hour - 6) / 12) * Math.PI;
    this.sun.position.set(Math.cos(ang) * 160, Math.sin(ang) * 160 + 30, 80);
    if (this._setNight) this._setNight(c.night);
    return c;
  }
}
