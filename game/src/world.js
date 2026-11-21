// The game's rules and state: the player on foot and in cars, the parked
// cars to steal, traffic, pedestrians, police, missions and combat, all
// stepped in fixed 1/60 s updates. step() returns events for the caller
// (mission complete, rammed, busted, wasted) so the world never touches
// screens or storage itself.
import * as THREE from 'three';
import { CITY, PLAYER_START, TUNE } from './config.js';
import { createRandom } from './random.js';
import { buildCity, collideCircle } from './city.js';
import { makeCar, stepPlayerCar, syncCarMesh } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { ACTION_ENTER, ACTION_PUNCH, ACTION_SHOOT } from './input.js';

function makePlayerMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.42, 1.05, 10),
    new THREE.MeshLambertMaterial({ color: 0x4fc3f7 }),
  );
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8b98a }),
  );
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.55, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x2e323d }),
  );
  legs.position.y = 0.28;
  group.add(legs);
  return group;
}

export function createWorld(scene, seed, audio) {
  const rng = createRandom(seed);
  const group = new THREE.Group();
  scene.add(group);
  const city = buildCity(group, rng);
  const traffic = createTraffic(group, rng);
  const peds = createPedestrians(group, rng);
  const police = createPolice(group);
  const missions = createMissions(group);
  const combat = createCombat(group);

  // Parked cars to steal, and the yellow sports car mission 2 needs.
  const parked = [];
  const parkedSpots = [
    { x: -149, z: -120, h: 0, c: 0xd9d9d9 },
    { x: -149, z: -40, h: Math.PI, c: 0x5a6b7d },
    { x: -149, z: 40, h: 0, c: 0xb03a2e },
    { x: -149, z: 120, h: Math.PI, c: 0x2e86ab },
    { x: 120, z: 91, h: Math.PI / 2, c: 0x8a94a6 },
    { x: -120, z: 91, h: -Math.PI / 2, c: 0x3d9970 },
  ];
  parkedSpots.forEach((spot) => {
    const car = makeCar('parked', spot.c, spot.x, spot.z, spot.h);
    car.mine = false;
    group.add(car.mesh);
    parked.push(car);
  });
  const sportsCar = makeCar('sports', 0xf2c94c, -80, -168, Math.PI / 2);
  sportsCar.mine = false;
  group.add(sportsCar.mesh);

  const playerMesh = makePlayerMesh();
  group.add(playerMesh);

  const player = {
    x: PLAYER_START.x,
    z: PLAYER_START.z,
    heading: PLAYER_START.heading,
    onFootSpeed: 0,
    health: 100,
    money: 150,
    bestMoney: 150,
    car: null,
  };
  let time = 0;
  let recentViolence = 0;
  let walkBob = 0;

  function allCars() {
    return [...parked, sportsCar, ...traffic.cars, ...police.cars];
  }

  function nearestStealable(maxDist) {
    let best = null;
    let bestD = maxDist;
    [...parked, sportsCar].forEach((car) => {
      if (car.disabled) return;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    });
    return best;
  }

  function respawn() {
    player.x = PLAYER_START.x;
    player.z = PLAYER_START.z;
    player.heading = PLAYER_START.heading;
    player.health = 100;
    player.car = null;
    playerMesh.visible = true;
    police.setWanted(0);
  }

  function step(dt, input, camHeading) {
    const events = [];
    time += dt;
    recentViolence = Math.max(0, recentViolence - dt);
    city.update(time);

    const actions = input.actions;
    if (actions & ACTION_ENTER) {
      if (player.car) {
        // Step out beside the car.
        const car = player.car;
        car.speed = 0;
        car.mine = true;
        player.x = car.x - Math.cos(car.heading) * 3;
        player.z = car.z + Math.sin(car.heading) * 3;
        player.heading = car.heading;
        player.car = null;
        playerMesh.visible = true;
      } else {
        const car = nearestStealable(4.5);
        if (car) {
          if (!car.mine) {
            car.mine = true;
            police.addWanted(1);
            events.push({ type: 'message', text: 'You stole a car! The cops noticed.' });
          }
          player.car = car;
          playerMesh.visible = false;
        }
      }
    }

    if (player.car) {
      const car = player.car;
      const crashed = stepPlayerCar(
        car,
        input.moveY,
        input.moveX,
        dt,
        city.colliders,
        allCars(),
        () => audio.crash(),
      );
      if (crashed) audio.crash();
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
      player.onFootSpeed = 0;
      audio.engine(Math.abs(car.speed) / car.maxSpeed, true);
    } else {
      // On foot: camera-relative movement.
      const fx = Math.sin(camHeading);
      const fz = Math.cos(camHeading);
      const rx = -Math.cos(camHeading);
      const rz = Math.sin(camHeading);
      let mx = fx * input.moveY + rx * input.moveX;
      let mz = fz * input.moveY + rz * input.moveX;
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
      const speed = input.running ? TUNE.runSpeed : TUNE.walkSpeed;
      player.x += mx * speed * dt;
      player.z += mz * speed * dt;
      player.onFootSpeed = len * speed;
      if (len > 0.1) {
        const targetHeading = Math.atan2(mx, mz);
        let diff = targetHeading - player.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        player.heading += Math.max(-10 * dt, Math.min(10 * dt, diff));
        walkBob += dt * (input.running ? 11 : 8);
      }
      const pos = { x: player.x, z: player.z };
      collideCircle(pos, TUNE.playerRadius, city.colliders);
      player.x = pos.x;
      player.z = pos.z;
      playerMesh.position.set(player.x, Math.abs(Math.sin(walkBob)) * 0.05, player.z);
      playerMesh.rotation.y = player.heading;
      audio.engine(0, false);

      if (actions & ACTION_PUNCH) {
        const hit = combat.punch(player, peds.peds);
        audio.thud();
        if (hit) {
          hit.state = 'down';
          hit.downTime = 3;
          police.addWanted(1);
          recentViolence = 3;
          events.push({ type: 'message', text: 'You knocked someone down!' });
        }
      }
      if (actions & ACTION_SHOOT) {
        const hit = combat.shoot(player, fx, fz, peds.peds, allCars());
        audio.shot();
        if (hit && hit.type === 'ped') {
          hit.ped.state = 'down';
          hit.ped.downTime = 3;
          police.addWanted(1);
          recentViolence = 3;
          events.push({ type: 'message', text: 'You shot a pedestrian! The cops are coming.' });
        } else if (hit && hit.type === 'car' && hit.car.kind === 'police') {
          police.addWanted(1);
        } else if (hit && hit.type === 'car' && hit.car.disabled) {
          events.push({ type: 'message', text: 'Car disabled!' });
        }
      }
    }

    // World systems.
    const playerCar = player.car;
    traffic.update(dt, playerCar, city.colliders);
    peds.update(dt, player, police.wanted, city.colliders, recentViolence > 0);
    const policeEvents = [];
    police.update(dt, player, city.colliders, allCars(), policeEvents);
    policeEvents.forEach((e) => {
      if (e.type === 'rammed' || e.type === 'shot-at') {
        player.health -= e.damage;
        events.push({ type: 'damage', damage: e.damage });
        audio.crash();
      } else if (e.type === 'busted') {
        events.push({ type: 'busted' });
      } else if (e.type === 'wanted-down') {
        events.push({ type: 'message', text: 'The heat is cooling off.' });
      }
    });
    combat.update(dt);

    // Missions.
    const missionEvents = [];
    missions.update(dt, player, police, sportsCar, missionEvents);
    missionEvents.forEach((e) => {
      if (e.type === 'mission-complete') {
        player.money += e.mission.reward;
        player.bestMoney = Math.max(player.bestMoney, player.money);
        audio.jingle();
        events.push({
          type: 'message',
          text: `Job done: ${e.mission.title} — +$${e.mission.reward}!`,
        });
        events.push(e);
      } else {
        events.push(e);
      }
    });

    // Health regen while clean; death.
    if (police.wanted === 0 && player.health < 100) {
      player.health = Math.min(100, player.health + TUNE.healthRegen * dt);
    }
    if (player.health <= 0) {
      events.push({ type: 'wasted' });
    }

    // Audio that follows the world.
    audio.siren(police.wanted > 0 && police.cars.length > 0);
    audio.music(true);

    return events;
  }

  return {
    player,
    sportsCar,
    parked,
    traffic,
    peds,
    police,
    missions,
    combat,
    city,
    group,
    get time() {
      return time;
    },
    step,
    respawn,
    /** Minimap view for the HUD. */
    minimapView() {
      return {
        player,
        police: police.cars,
        traffic: traffic.cars,
        missionTarget: missions.targetPos(),
      };
    },
    /** Save payload: money and finished jobs. */
    saveData() {
      return { money: player.money, bestMoney: player.bestMoney, done: missions.done };
    },
    loadSave(data) {
      if (!data) return;
      if (typeof data.money === 'number') {
        player.money = data.money;
        player.bestMoney = Math.max(data.money, data.bestMoney || 0);
      }
      if (Array.isArray(data.done)) missions.load(data.done);
    },
    /** Put the player in a car at a spot (used by the staged screenshots). */
    putInCar(car, x, z, heading, speed) {
      player.car = car;
      car.x = x;
      car.z = z;
      car.heading = heading;
      car.speed = speed;
      car.mine = true;
      player.x = x;
      player.z = z;
      player.heading = heading;
      playerMesh.visible = false;
      syncCarMesh(car);
    },
    /** Put the player on foot at a spot (used by the staged screenshots). */
    putOnFoot(x, z, heading) {
      player.car = null;
      player.x = x;
      player.z = z;
      player.heading = heading;
      playerMesh.visible = true;
      playerMesh.position.set(x, 0, z);
      playerMesh.rotation.y = heading;
    },
  };
}
