// The three story missions, chained in order. Each one names its target,
// its radius and its reward in config.js; this file only runs the state
// machine and draws the yellow beacon that marks where to go.
// The markers sit outside their buildings on purpose: the mission 1 target
// is on the sand north of the Beach Cafe (the cafe box ends at z -34, the
// marker is at z -30), and the mission 2 target is north of the garage (the
// garage box ends at z 161, the marker is at z 152). A marker inside a
// building collider can never be reached, and that is the bug this rebuild
// exists to fix.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { dist2d } from './random.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.done = [];
    this.stage = 'reach'; // reach | steal | deliver | escape
    this.escapeArmed = false;
    this.beacon = this.makeBeacon();
    scene.add(this.beacon.group);
    this.updateBeacon();
  }

  makeBeacon() {
    const group = new THREE.Group();
    // A flat ring on the ground plus a tall beam of light, both warm yellow.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.22, 10, 40),
      new THREE.MeshStandardMaterial({
        color: 0xffd94d, emissive: 0xffc21a, emissiveIntensity: 1.6,
        transparent: true, opacity: 0.95,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    group.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.6, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd94d, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    beam.position.y = 21;
    group.add(beam);
    return { group, ring, beam };
  }

  current() {
    return CONFIG.missions[this.index] || null;
  }

  allDone() {
    return this.index >= CONFIG.missions.length;
  }

  // Where the beacon points right now (null when no mission is active).
  targetPos() {
    const m = this.current();
    if (!m) return null;
    if (m.type === 'steal-deliver') {
      return this.stage === 'steal' ? m.carAt : m.target;
    }
    return m.target || null;
  }

  objectiveText() {
    const m = this.current();
    if (!m) return 'All jobs done — Sunset Bay is yours. Free roam!';
    if (m.type === 'steal-deliver' && this.stage === 'steal') {
      return `${m.title}: steal the yellow sports car.`;
    }
    if (m.type === 'steal-deliver' && this.stage === 'deliver') {
      return `${m.title}: deliver the sports car to the garage marker.`;
    }
    if (m.type === 'escape') {
      return `${m.title}: lose the cops and get your wanted level to zero.`;
    }
    return `${m.title}: ${m.brief}`;
  }

  updateBeacon() {
    const pos = this.targetPos();
    if (!pos) {
      this.beacon.group.visible = false;
      return;
    }
    this.beacon.group.visible = true;
    this.beacon.group.position.set(pos.x, 0, pos.z);
  }

  // Spin the beacon ring slowly; called every frame with the world time.
  animateBeacon(elapsed) {
    if (!this.beacon.group.visible) return;
    this.beacon.ring.rotation.z = elapsed * 0.8;
    const pulse = 0.85 + Math.sin(elapsed * 2.4) * 0.15;
    this.beacon.ring.material.opacity = pulse;
  }

  complete(world, mission) {
    world.player.money += mission.reward;
    this.done.push(mission.id);
    this.index += 1;
    this.stage = 'reach';
    this.escapeArmed = false;
    // The car job puts the cops on Raka: the escape mission starts with real
    // heat, so there is always something to lose. Without this the wanted
    // level from the theft fades away on the drive to the garage and the
    // escape can never arm (it needs wanted >= 2 before it can complete
    // at zero), so a clean delivery would leave the third mission stuck.
    const next = this.current();
    if (next && next.type === 'escape') {
      world.police.setWanted(3);
      world.toast('The cops are onto you — lose them!');
    }
    this.updateBeacon();
    return mission.reward;
  }

  // Advance the missions. `world` gives the player, the police and the audio.
  // Returns the mission that completed this frame, if any.
  update(dt, world) {
    const m = this.current();
    if (!m) return null;
    const p = world.player;

    if (m.type === 'reach') {
      const d = dist2d(p.x, p.z, m.target.x, m.target.z);
      if (d <= m.radius) {
        return this.complete(world, m);
      }
      return null;
    }

    if (m.type === 'steal-deliver') {
      if (this.stage === 'steal') {
        // The sports car is the yellow one parked at carAt; getting in it
        // flips the mission to the delivery leg.
        if (p.inCar && p.car && p.car.isSportsCar) {
          this.stage = 'deliver';
          this.updateBeacon();
          world.toast('Nice ride. Now get it to the garage marker.');
        }
        return null;
      }
      const d = dist2d(p.x, p.z, m.target.x, m.target.z);
      if (p.inCar && d <= m.radius) {
        return this.complete(world, m);
      }
      return null;
    }

    if (m.type === 'escape') {
      // Arm once the heat is on, then complete when it is fully gone.
      if (!this.escapeArmed && world.police.wanted >= 2) {
        this.escapeArmed = true;
      }
      if (this.escapeArmed && world.police.wanted === 0) {
        return this.complete(world, m);
      }
      return null;
    }
    return null;
  }
}
