// Rendering for Vice Rush: the WebGL renderer, the chase camera, and
// the day-night cycle. The camera sits behind the player and looks the
// way the camera yaw points; it lerps, so it glides instead of
// snapping, and a snap call puts it exactly where it belongs after a
// teleport. The sun, the fog and the sky all lerp through keyframes as
// the 24-hour clock turns, so sunset melts into night and back.

import * as THREE from 'three';
import { DAY_KEYS } from './config.js';

function hexLerp(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

export function dayColors(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < DAY_KEYS.length - 2 && DAY_KEYS[i + 1].h <= h) i++;
  const a = DAY_KEYS[i];
  const b = DAY_KEYS[i + 1];
  const t = Math.max(0, Math.min(1, (h - a.h) / (b.h - a.h)));
  return {
    sun: hexLerp(a.sun, b.sun, t),
    sunI: a.sunI + (b.sunI - a.sunI) * t,
    fog: hexLerp(a.fog, b.fog, t),
    sky: hexLerp(a.sky, b.sky, t),
    hemi: hexLerp(a.hemi, b.hemi, t),
  };
}

export class Render {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x3a2530);
    this.scene.fog = new THREE.Fog(0x6b4a52, 90, 420);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(10, 8, 44);
    this.lookTarget = new THREE.Vector3(10, 2, 24);

    this.sun = new THREE.DirectionalLight(0xff7a2a, 0.9);
    this.sun.position.set(120, 180, 60);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0x8a5a4a, 0x2a2018, 0.7);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x404050, 0.5);
    this.scene.add(this.ambient);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Recolour the light, fog and sky for the hour. Called every frame;
  // the lerp is cheap and the change is gradual.
  updateDayNight(hour) {
    const c = dayColors(hour);
    this.sun.color.copy(c.sun);
    this.sun.intensity = c.sunI;
    this.scene.fog.color.copy(c.fog);
    this.scene.background.copy(c.sky);
    this.hemi.color.copy(c.hemi);
    // The sun swings low at dusk and high at noon.
    const angle = ((hour - 6) / 12) * Math.PI;
    this.sun.position.set(Math.cos(angle) * 160, Math.sin(angle) * 160 + 30, 80);
  }

  // Chase camera. camYaw is the direction the camera looks; the camera
  // sits behind the player by camDist and a little above. snap=true
  // puts it there at once (after a teleport).
  follow(world, dt, snap) {
    const p = world.player;
    const yaw = world.camYaw;
    const dist = world.camDist;
    const height = 4.5 + world.camPitch * 4 + (p.onFoot ? 0 : 1.2);
    const bx = Math.sin(yaw);
    const bz = Math.cos(yaw);
    const cx = p.x - bx * dist;
    const cz = p.z - bz * dist;
    const k = snap ? 1 : 1 - Math.exp(-7 * dt);
    const lk = snap ? 1 : 1 - Math.exp(-10 * dt);
    this.camera.position.x += (cx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (cz - this.camera.position.z) * k;
    const tx = p.x + bx * 4;
    const ty = p.onFoot ? 1.6 : 1.8;
    const tz = p.z + bz * 4;
    this.lookTarget.x += (tx - this.lookTarget.x) * lk;
    this.lookTarget.y += (ty - this.lookTarget.y) * lk;
    this.lookTarget.z += (tz - this.lookTarget.z) * lk;
    this.camera.lookAt(this.lookTarget);
  }

  snapCamera(world) {
    this.follow(world, 10, true);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
