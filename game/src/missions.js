// The story, in three jobs for Raka, new in town and working for Mira.
// Each mission has a beacon in the world and a marker on the minimap; the
// update returns events (completed, stage changes) for the world to act on.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

function makeBeacon(color) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = 17;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  return group;
}

export function createMissions(scene) {
  const beacon = makeBeacon(0xf2c94c);
  beacon.visible = false;
  scene.add(beacon);
  let index = 0;
  let stage = 'go'; // 'go' | 'deliver' | 'raise' | 'lose'
  let done = [];
  let time = 0;

  function current() {
    return MISSIONS[index] || null;
  }
  function targetPos() {
    const m = current();
    if (!m) return null;
    if (m.type === 'steal-deliver') return stage === 'deliver' ? m.garage : m.target;
    return m.target;
  }

  return {
    get done() {
      return done;
    },
    get index() {
      return index;
    },
    current,
    targetPos,
    objectiveText() {
      const m = current();
      if (!m) return 'All jobs done — Sunset Bay is yours. Free roam!';
      if (m.type === 'steal-deliver' && stage === 'deliver') {
        return `${m.title}: deliver the car to the garage marker.`;
      }
      if (m.type === 'escape' && stage === 'lose') {
        return `${m.title}: lose the cops — get wanted back to zero.`;
      }
      if (m.type === 'escape' && stage === 'raise') {
        return `${m.title}: raise your wanted level to 3 stars.`;
      }
      return `${m.title}: ${m.brief}`;
    },
    /** Restore progress loaded from a save. */
    load(doneIds) {
      done = MISSIONS.filter((m) => doneIds.includes(m.id)).map((m) => m.id);
      index = done.length;
      stage = 'go';
    },
    update(dt, player, police, targetCar, events) {
      time += dt;
      const m = current();
      const target = targetPos();
      if (!m || !target) {
        beacon.visible = false;
        return;
      }
      beacon.visible = true;
      beacon.position.set(target.x, 0, target.z);
      beacon.rotation.y = time * 0.6;
      const dist = Math.hypot(player.x - target.x, player.z - target.z);

      if (m.type === 'reach') {
        if (dist < m.radius) {
          done = [...done, m.id];
          index += 1;
          stage = 'go';
          events.push({ type: 'mission-complete', mission: m });
        }
        return;
      }
      if (m.type === 'steal-deliver') {
        if (stage === 'go') {
          if (player.car === targetCar) {
            stage = 'deliver';
            police.addWanted(2);
            events.push({ type: 'message', text: 'You stole the car! Get it to the garage — and lose the heat.' });
          }
          return;
        }
        if (stage === 'deliver' && player.car === targetCar && dist < m.radius) {
          done = [...done, m.id];
          index += 1;
          stage = 'go';
          events.push({ type: 'mission-complete', mission: m });
        }
        return;
      }
      if (m.type === 'escape') {
        if (stage === 'go') {
          stage = 'raise';
          return;
        }
        if (stage === 'raise' && police.wanted >= 3) {
          stage = 'lose';
          events.push({ type: 'message', text: 'Three stars! Now lose them.' });
          return;
        }
        if (stage === 'lose' && police.wanted === 0) {
          done = [...done, m.id];
          index += 1;
          stage = 'go';
          events.push({ type: 'mission-complete', mission: m });
        }
      }
    },
  };
}
