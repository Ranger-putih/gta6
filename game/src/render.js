// The renderer: the WebGL canvas, the sunset lighting, the fog, and the
// chase camera that follows the player. The camera eases toward its target
// every frame and snaps instantly when asked (after a teleport, or when a
// staged shot frames the scene).

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    // A warm dusk sky; the fog melts the far city into it.
    this.scene.background = new THREE.Color(0xf2a35e);
    this.scene.fog = new THREE.Fog(0xe89a5e, 120, 420);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
    this.resize();

    // Sunset key light, low and warm, plus a cool fill from the sea side.
    const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
    sun.position.set(-120, 90, -160);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 700;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xffd9a0, 0x3a4a5a, 0.9));
    const fill = new THREE.DirectionalLight(0x7fa8c9, 0.5);
    fill.position.set(200, 60, 120);
    this.scene.add(fill);

    // The sun itself, a low disc over the sea.
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
    );
    sunDisc.position.set(330, 42, -40);
    sunDisc.lookAt(0, 42, -40);
    this.scene.add(sunDisc);

    // Muzzle flash: a small point light that lives for a blink after a shot.
    this.flash = new THREE.PointLight(0xffd27a, 0, 18);
    this.scene.add(this.flash);

    // Camera orbit state: yaw around the player and pitch above them.
    this.orbitYaw = 0;
    this.orbitPitch = 0.32;
    this.camPos = new THREE.Vector3(0, 20, -30);
    this.lookAt = new THREE.Vector3(0, 0, 0);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Place the camera behind the target (player or car) at the current orbit.
  // `snap` jumps straight there instead of easing (teleports, shot framing).
  follow(dt, targetX, targetZ, targetHeading, snap = false) {
    const cfg = CONFIG.camera;
    const dist = cfg.distance;
    // The camera sits behind the target, opposite its heading, plus the
    // user's orbit yaw. Pitch lifts it above the ground.
    const yaw = targetHeading + Math.PI + this.orbitYaw;
    const px = targetX + Math.sin(yaw) * Math.cos(this.orbitPitch) * dist;
    const pz = targetZ + Math.cos(yaw) * Math.cos(this.orbitPitch) * dist;
    const py = cfg.height + Math.sin(this.orbitPitch) * dist;
    const k = snap ? 1 : 1 - Math.exp(-cfg.followLerp * dt);
    this.camPos.x += (px - this.camPos.x) * k;
    this.camPos.y += (py - this.camPos.y) * k;
    this.camPos.z += (pz - this.camPos.z) * k;
    // Look slightly ahead of the target, at chest height.
    const lx = targetX + Math.sin(targetHeading) * 3;
    const lz = targetZ + Math.cos(targetHeading) * 3;
    this.lookAt.x += (lx - this.lookAt.x) * k;
    this.lookAt.y += (1.6 - this.lookAt.y) * k;
    this.lookAt.z += (lz - this.lookAt.z) * k;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.lookAt);
  }

  // A snap-to after a teleport: one call with dt=10 settles instantly.
  snapTo(targetX, targetZ, targetHeading) {
    this.follow(10, targetX, targetZ, targetHeading, true);
  }

  setFlash(x, z, on) {
    this.flash.position.set(x, 2, z);
    this.flash.intensity = on ? 60 : 0;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
