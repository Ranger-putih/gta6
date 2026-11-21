// The wanted level and the police who answer it. Crimes raise the stars;
// staying clean lets them fall. Police cars spawn on nearby roads, chase the
// player, ram their car, and bust a slow player on foot.
import { TUNE } from './config.js';
import { makeCar, syncCarMesh } from './vehicles.js';
import { collideCircle } from './city.js';

export function createPolice(scene) {
  const cars = [];
  let wanted = 0;
  let decayTimer = 0;
  let crimeTimer = 0;
  let bustTimer = 0;
  let shootTimer = 0;
  let spawnCooldown = 0;

  function spawnNear(player) {
    // Spawn on a road a little way from the player, facing them.
    const angle = Math.random() * Math.PI * 2;
    const x = player.x + Math.cos(angle) * 55;
    const z = player.z + Math.sin(angle) * 55;
    const car = makeCar('police', 0x2b4acb, x, z, Math.atan2(player.x - x, player.z - z));
    car.maxSpeed = 44;
    car.ramCooldown = 0;
    car.health = 100;
    scene.add(car.mesh);
    cars.push(car);
    return car;
  }

  return {
    cars,
    get wanted() {
      return wanted;
    },
    setWanted(value) {
      wanted = Math.max(0, Math.min(5, value));
      decayTimer = 0;
    },
    /** Spawn a police car at an exact spot (used by the staged screenshots). */
    spawnAt(x, z, heading) {
      const car = makeCar('police', 0x2b4acb, x, z, heading);
      car.maxSpeed = 44;
      car.ramCooldown = 0;
      car.health = 100;
      scene.add(car.mesh);
      cars.push(car);
      return car;
    },
    /** A crime: raise the stars and stop the decay clock for a while. */
    addWanted(amount) {
      wanted = Math.max(0, Math.min(5, wanted + amount));
      crimeTimer = 8;
      decayTimer = 0;
    },
    update(dt, player, colliders, others, events) {
      crimeTimer = Math.max(0, crimeTimer - dt);
      spawnCooldown = Math.max(0, spawnCooldown - dt);
      // Decay one star after staying clean for a while.
      if (wanted > 0 && crimeTimer <= 0) {
        decayTimer += dt;
        if (decayTimer > TUNE.wantedDecaySeconds) {
          wanted -= 1;
          decayTimer = 0;
          events.push({ type: 'wanted-down', wanted });
        }
      }
      const targetCount = wanted > 0 ? Math.min(3, wanted) : 0;
      while (cars.length < targetCount && spawnCooldown <= 0) {
        spawnNear(player);
        spawnCooldown = 1.2;
      }
      while (cars.length > targetCount) {
        const car = cars.pop();
        scene.remove(car.mesh);
      }
      // Pursuit: steer toward the player's predicted position.
      const playerCar = player.car;
      const px = player.x;
      const pz = player.z;
      const pvx = playerCar ? Math.sin(playerCar.heading) * playerCar.speed : 0;
      const pvz = playerCar ? Math.cos(playerCar.heading) * playerCar.speed : 0;
      let nearest = Infinity;
      let playerSlow = true;
      cars.forEach((car) => {
        const tx = px + pvx * 0.4;
        const tz = pz + pvz * 0.4;
        const dx = tx - car.x;
        const dz = tz - car.z;
        const dist = Math.hypot(dx, dz);
        nearest = Math.min(nearest, dist);
        const wantedHeading = Math.atan2(dx, dz);
        let diff = wantedHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
        const targetSpeed = dist > 8 ? car.maxSpeed : car.maxSpeed * 0.5;
        car.speed += (targetSpeed - car.speed) * Math.min(1, 1.5 * dt);
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        car.spin += (car.speed * dt) / 0.42;
        car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
        collideCircle(car, 2.3, colliders);
        // Ram the player's car, or the player on foot.
        if (dist < 4.6 && car.ramCooldown <= 0) {
          car.ramCooldown = 1.2;
          car.speed *= 0.55;
          if (playerCar) {
            playerCar.speed *= 0.6;
            events.push({ type: 'rammed', damage: TUNE.policeRamDamage });
          } else {
            events.push({ type: 'rammed', damage: TUNE.policeRamDamage });
          }
        }
        // Push apart from the other cars.
        others.forEach((other) => {
          if (other === car || other.disabled) return;
          const ox = car.x - other.x;
          const oz = car.z - other.z;
          const od = Math.hypot(ox, oz);
          if (od > 0.001 && od < 4.6) {
            const push = (4.6 - od) / 2;
            car.x += (ox / od) * push;
            car.z += (oz / od) * push;
            other.x -= (ox / od) * push;
            other.z -= (oz / od) * push;
          }
        });
        syncCarMesh(car);
        if (Math.abs(playerCar ? playerCar.speed : 0) > 2 || player.onFootSpeed > 1.5) playerSlow = false;
      });
      // Busted: on foot, slow, and a police car right next to the player.
      if (wanted > 0 && !playerCar && nearest < 7 && playerSlow) {
        bustTimer += dt;
        if (bustTimer > TUNE.bustSeconds) {
          bustTimer = 0;
          events.push({ type: 'busted' });
        }
      } else {
        bustTimer = Math.max(0, bustTimer - dt * 2);
      }
      // At 3+ stars the police shoot at a player on foot.
      shootTimer -= dt;
      if (wanted >= 3 && !playerCar && nearest < 32 && shootTimer <= 0) {
        shootTimer = 1.4;
        if (Math.random() < 0.45) events.push({ type: 'shot-at', damage: TUNE.policeShootDamage });
      }
    },
  };
}
