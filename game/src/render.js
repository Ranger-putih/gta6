// The Three.js renderer: sunset lighting and fog, shadows, and the
// third-person chase camera that follows the player on foot or in a car.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 130, 460);

  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a4a6b, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-180, 140, -120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -280;
  sun.shadow.camera.right = 280;
  sun.shadow.camera.top = 280;
  sun.shadow.camera.bottom = -280;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);
  camera.position.set(0, 30, 60);

  const camPos = new THREE.Vector3(0, 30, 60);
  const lookTarget = new THREE.Vector3(0, 2, 0);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    /** Chase camera: behind the player, smoothed, orbitable. */
    follow(player, orbit, dist, dt) {
      const yaw = player.heading + Math.PI + orbit.x;
      const pitch = Math.max(0.08, Math.min(0.9, orbit.y));
      const dx = Math.sin(yaw) * Math.cos(pitch);
      const dz = Math.cos(yaw) * Math.cos(pitch);
      const dy = Math.sin(pitch);
      const desired = new THREE.Vector3(
        player.x + dx * dist,
        2.4 + dy * dist,
        player.z + dz * dist,
      );
      const k = 1 - Math.exp(-7 * dt);
      camPos.lerp(desired, k);
      camera.position.copy(camPos);
      lookTarget.lerp(new THREE.Vector3(player.x, 2.2, player.z), 1 - Math.exp(-10 * dt));
      camera.lookAt(lookTarget);
    },
    /** Put the camera exactly here (used by the staged screenshots). */
    setPose(x, y, z, lookX, lookY, lookZ) {
      camPos.set(x, y, z);
      lookTarget.set(lookX, lookY, lookZ);
      camera.position.copy(camPos);
      camera.lookAt(lookTarget);
    },
    render() {
      renderer.render(scene, camera);
    },
  };
}
