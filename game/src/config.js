// Vice Rush — central tuning numbers, missions, shots and world layout.
// Every system reads its constants from here so balancing stays in one place.

export const WORLD = {
  half: 200,
  roadCoords: [-160, -80, 0, 80, 160],
  roadWidth: 12,
  beachStart: 166,
  waterStart: 196,
};

export const DISTRICTS = [
  'Downtown',
  'Sunset Beach',
  'Old Town',
  'Harbor',
  'North Hills',
  'South Docks',
];

export function districtAt(x, z) {
  if (x > 130) return 'Sunset Beach';
  if (z > 80) return 'South Docks';
  if (x < -80 && z < -80) return 'Old Town';
  if (x > 80 && z < -80) return 'Harbor';
  if (z < -80) return 'North Hills';
  return 'Downtown';
}

export const RANKS = [
  { name: 'Rookie', xp: 0 },
  { name: 'Wheelman', xp: 300 },
  { name: 'Hustler', xp: 800 },
  { name: 'Fixer', xp: 1500 },
  { name: 'Kingpin', xp: 2500 },
];

export function rankForXp(xp) {
  let rank = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].xp) rank = RANKS[i];
    else { next = RANKS[i]; break; }
  }
  return { rank, next };
}

// Missions: five staged jobs. Par times are in game-seconds; gold is hard
// but reachable with a clean drive, silver is a comfortable pace.
export const MISSIONS = [
  {
    id: 'M1',
    name: 'Package for Mira',
    reward: 300,
    xp: 300,
    gold: 45,
    silver: 75,
    stages: [
      { type: 'goto', x: 176, z: -8, radius: 8, label: 'Deliver the package to Beach Cafe' },
    ],
  },
  {
    id: 'M2',
    name: 'Hot Wheels',
    reward: 500,
    xp: 500,
    gold: 90,
    silver: 150,
    stages: [
      { type: 'steal', x: -74, z: -168, car: 'gold-sports', label: 'Steal the gold sports car' },
      { type: 'deliver', x: -168, z: 152, radius: 9, label: 'Deliver it to the garage' },
    ],
  },
  {
    id: 'M3',
    name: 'Lose the Heat',
    reward: 400,
    xp: 400,
    gold: 30,
    silver: 60,
    stages: [
      { type: 'escape', label: 'Lose the cops — get wanted to zero' },
    ],
  },
  {
    id: 'M4',
    name: 'Sunset Sprint',
    reward: 600,
    xp: 600,
    gold: 50,
    silver: 80,
    stages: [
      {
        type: 'race',
        checkpoints: [[0, 80], [80, 80], [80, -80], [160, -80], [160, 80], [80, 160]],
        radius: 8,
        label: 'Sunset Sprint — hit every checkpoint',
      },
    ],
  },
  {
    id: 'M5',
    name: 'Night Market Heat',
    reward: 700,
    xp: 700,
    gold: 120,
    silver: 200,
    stages: [
      { type: 'goto', x: -160, z: 160, radius: 10, label: 'Reach the Night Market' },
      { type: 'eliminate', count: 5, x: -160, z: 160, label: 'Take down the 5 crew members' },
      { type: 'escape', label: 'Lose the cops — get wanted to zero' },
    ],
  },
];

export function ratingForTime(seconds, mission) {
  if (seconds <= mission.gold) return 'GOLD';
  if (seconds <= mission.silver) return 'SILVER';
  return 'BRONZE';
}

// Ten hidden Sunset Coins, one per landmark, spread over all six districts.
// Every spot is open ground (road, plaza, park or beach) — never inside a
// building footprint, so a car or a walker can always reach the coin.
export const COINS = [
  { x: 40, z: 40, place: 'Downtown Plaza' },
  { x: 120, z: -40, place: 'Sunset Park' },
  { x: 176, z: -40, place: 'Beach north' },
  { x: 172, z: 96, place: 'Beach Cafe' },
  { x: 172, z: -120, place: 'Beach far north' },
  { x: -160, z: -160, place: 'Old Town corner' },
  { x: 0, z: -160, place: 'North Hills' },
  { x: -160, z: 80, place: 'South Docks' },
  { x: 80, z: 80, place: 'Downtown crossing' },
  { x: -160, z: 160, place: 'Night Market' },
];

export const COIN_VALUE = 25;

// Parked cars the player can take. Positions sit on road edges or open
// strips, never on the M4 race line and never inside a building.
export const PARKED_CARS = [
  { x: 8, z: 140, heading: Math.PI, color: 0x3f6fb5, model: 'sedan', name: 'Sunset Sedan' },
  { x: -74, z: -168, heading: Math.PI / 2, color: 0xd8a017, model: 'sports', name: 'Gold Sports' },
  { x: -86, z: 40, heading: 0, color: 0x7a4a8c, model: 'suv', name: 'Harbor SUV' },
  { x: 166, z: -160, heading: -Math.PI / 2, color: 0x4a7a5a, model: 'pickup', name: 'Docks Pickup' },
  { x: 6, z: -80, heading: Math.PI, color: 0xb03a2e, model: 'bike', name: 'Sunset Bike' },
];

// Gang members posted around the Night Market for M5. Every spot is open
// ground on a road or edge strip — never inside the stall block — so a car
// can reach each of them without ramming a stall.
export const GANG_SPOTS = [
  { x: -150, z: 158 },
  { x: -170, z: 150 },
  { x: -150, z: 172 },
  { x: -172, z: 168 },
  { x: -140, z: 152 },
];

export const PLAYER_SPAWN = { x: 0, z: 170, heading: Math.PI };

export const SHOTS = [
  { id: 'heli', file: '1-heli-chase.jpg', seed: 7 },
  { id: 'market', file: '2-market.jpg', seed: 3 },
  { id: 'race', file: '3-race.jpg', seed: 5 },
  { id: 'dusk', file: '4-dusk.jpg', seed: 2 },
];

// Day-night keyframes: hour -> sky colour, fog colour, sun colour/intensity.
export const DAY_KEYS = [
  { h: 0, sky: 0x05070f, fog: 0x05070f, sun: 0x8fa3c7, sunI: 0.12, hemi: 0.25 },
  { h: 5, sky: 0x0b0e1e, fog: 0x0b0e1e, sun: 0x8fa3c7, sunI: 0.15, hemi: 0.28 },
  { h: 6, sky: 0x2a1f2e, fog: 0x2a1f2e, sun: 0xff9a5c, sunI: 0.5, hemi: 0.4 },
  { h: 8, sky: 0x7fb2d9, fog: 0x7fb2d9, sun: 0xfff2d0, sunI: 1.0, hemi: 0.7 },
  { h: 12, sky: 0x87b5e0, fog: 0x87b5e0, sun: 0xffffff, sunI: 1.25, hemi: 0.85 },
  { h: 16, sky: 0x8fb8dd, fog: 0x8fb8dd, sun: 0xfff0c0, sunI: 1.1, hemi: 0.8 },
  { h: 17.5, sky: 0xf2a35e, fog: 0xe8955a, sun: 0xffb36b, sunI: 0.9, hemi: 0.6 },
  { h: 18.5, sky: 0x454354, fog: 0x454354, sun: 0xff8a50, sunI: 0.45, hemi: 0.45 },
  { h: 20, sky: 0x0d1024, fog: 0x0d1024, sun: 0x8fa3c7, sunI: 0.2, hemi: 0.3 },
  { h: 22, sky: 0x05070f, fog: 0x05070f, sun: 0x8fa3c7, sunI: 0.12, hemi: 0.25 },
  { h: 24, sky: 0x05070f, fog: 0x05070f, sun: 0x8fa3c7, sunI: 0.12, hemi: 0.25 },
];

export const SAVE_KEY = 'vice-rush-save-v6';
export const START_MONEY = 150;
export const START_HOUR = 17.5;
export const WANTED_DECAY_SECONDS = 14;
export const TRAFFIC_COUNT = 20;
export const PEDESTRIAN_COUNT = 30;
