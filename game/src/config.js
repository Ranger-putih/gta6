// Vice Rush — every number that shapes Sunset Bay lives here, so tuning
// the game means editing this file, not hunting through the systems.
// The city is a 400 by 400 metre grid, roads every 80 metres, with a
// beach and the sea along its eastern edge.

export const CITY_HALF = 200;
export const ROADS = [-160, -80, 0, 80, 160];
export const ROAD_WIDTH = 12;
export const PLAYER_START = { x: 10, z: 24, heading: Math.PI };
export const START_MONEY = 150;
export const START_AMMO = 48;
export const MAX_AMMO = 120;

export const TRAFFIC_COUNT = 20;
export const PED_COUNT = 30;
export const MAX_TRAFFIC = 25;
export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 14;

// Six named districts. The HUD shows the one the player stands in, the
// way a real city game names its neighbourhoods.
export const DISTRICTS = [
  'Downtown',
  'Sunset Beach',
  'Old Town',
  'Harbor',
  'North Hills',
  'South Docks',
];

export function districtAt(x, z) {
  if (x > 160) return 'Sunset Beach';
  if (x < -120 && z < 0) return 'Old Town';
  if (x < -120 && z >= 0) return 'Harbor';
  if (z < -120) return 'North Hills';
  if (z > 120) return 'South Docks';
  return 'Downtown';
}

// Ranks. Experience comes from missions; each rank up is a toast and a
// louder engine note. The bar in the HUD fills toward the next rank.
export const RANKS = [
  { name: 'Rookie', xp: 0 },
  { name: 'Wheelman', xp: 500 },
  { name: 'Hustler', xp: 1200 },
  { name: 'Fixer', xp: 2500 },
  { name: 'Kingpin', xp: 5000 },
];

export function rankFor(xp) {
  let rank = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].xp) rank = RANKS[i];
    else {
      next = RANKS[i];
      break;
    }
  }
  return { rank, next };
}

// Weapons. Fists never run out; the pistol eats ammo, and a finished
// mission tops the mags back up.
export const WEAPONS = {
  fists: { key: 'fists', name: 'FISTS', damage: 25, range: 2.6, rate: 0.4, ammo: Infinity },
  pistol: { key: 'pistol', name: 'PISTOL', damage: 34, range: 48, rate: 0.25, ammo: START_AMMO },
};

// Car models. top is metres per second (42 is about 150 km/h).
export const CAR_MODELS = {
  sedan: { key: 'sedan', name: 'Sedan', color: 0xb03a2e, top: 32, accel: 13, grip: 1.0 },
  sports: { key: 'sports', name: 'Sports', color: 0xf2c200, top: 42, accel: 16, grip: 1.15 },
  pickup: { key: 'pickup', name: 'Pickup', color: 0x2e7d5b, top: 30, accel: 12, grip: 0.95 },
  van: { key: 'van', name: 'Van', color: 0xe8e8e8, top: 26, accel: 10, grip: 0.9 },
  taxi: { key: 'taxi', name: 'Taxi', color: 0xffc400, top: 32, accel: 13, grip: 1.0 },
  bike: { key: 'bike', name: 'Bike', color: 0x222831, top: 38, accel: 18, grip: 1.25 },
  police: { key: 'police', name: 'Cruiser', color: 0x14213d, top: 36, accel: 15, grip: 1.1 },
};

// Where the parked cars wait. Every spot sits on a road, offset to the
// curb, so no building can ever swallow one.
export const PARKED_CARS = [
  { model: 'sedan', x: 4, z: 40, heading: Math.PI },
  { model: 'sedan', x: 84, z: -120, heading: 0 },
  { model: 'pickup', x: -76, z: 40, heading: Math.PI },
  { model: 'van', x: 124, z: 4, heading: Math.PI / 2 },
  { model: 'taxi', x: -156, z: -120, heading: Math.PI },
  { model: 'sedan', x: 44, z: 156, heading: Math.PI / 2 },
  { model: 'sedan', x: -44, z: -84, heading: -Math.PI / 2 },
  { model: 'sedan', x: 4, z: -120, heading: 0 },
];

// The sports car Mira wants stolen, and the motorcycle by the beach road.
export const SPORTS_CAR = { model: 'sports', x: -80, z: -168, heading: Math.PI };
export const MOTORCYCLE = { model: 'bike', x: 164, z: 120, heading: Math.PI };

// The Beach Cafe and the garage. Their colliders are the law: mission
// targets sit outside them, never inside, so a target is always reachable.
export const BEACH_CAFE = { x: 208, z: -40, w: 16, d: 12 };
export const GARAGE = { x: -180, z: 168, w: 16, d: 16 };

// The Night Market: five stalls around the (-160, 160) crossroads. The
// four blocks touching that corner grow stalls instead of buildings.
export const MARKET_CENTER = { x: -160, z: 160 };
export const MARKET_STALLS = [
  { x: -172, z: 142 },
  { x: -148, z: 142 },
  { x: -172, z: 178 },
  { x: -148, z: 178 },
  { x: -185, z: 170 },
];

// The five gang members for the Night Market mission. Each stands on a
// road around the market, clear of stalls and of every building.
export const GANG_SPAWNS = [
  { x: -160, z: 140 },
  { x: -160, z: 180 },
  { x: -140, z: 160 },
  { x: -180, z: 160 },
  { x: -150, z: 150 },
];

// The Sunset Sprint race route: start line, then six checkpoints, all on
// road crossings. The loop runs down the eastern avenues and back.
export const RACE_START = { x: 0, z: 160 };
export const RACE_CHECKPOINTS = [
  { x: 80, z: 160 },
  { x: 160, z: 160 },
  { x: 160, z: 80 },
  { x: 160, z: 0 },
  { x: 160, z: -80 },
  { x: 80, z: -80 },
];
export const RACE_GOLD_SECONDS = 50;
export const RACE_SILVER_SECONDS = 80;

// Missions. A mission is a chain of stages; the HUD shows STAGE n/N.
// Stage types: goto (reach a point), steal (get in a named car),
// deliver (drive a car to a point), race (checkpoints on a timer),
// eliminate (take out a count of gang members), escape (lose the wanted
// level). Targets are always on open ground — roads, the beach, or a
// plaza — never inside a building footprint.
export const MISSIONS = [
  {
    id: 'package',
    name: 'Package for Mira',
    reward: 300,
    xp: 300,
    brief: 'Mira needs a package from the Beach Cafe. Walk or drive there.',
    stages: [
      { type: 'goto', name: 'Reach the Beach Cafe', x: 208, z: -30, radius: 5 },
    ],
  },
  {
    id: 'steal',
    name: 'Hot Wheels',
    reward: 500,
    xp: 500,
    brief: 'Steal the yellow sports car up north and bring it to the garage.',
    stages: [
      { type: 'steal', name: 'Steal the sports car', car: 'sports', x: -80, z: -168, radius: 6 },
      { type: 'deliver', name: 'Deliver to the garage', x: -168, z: 152, radius: 6 },
    ],
  },
  {
    id: 'escape',
    name: 'Lose the Heat',
    reward: 400,
    xp: 400,
    brief: 'The cops are onto you. Lose them — break line of sight and wait.',
    stages: [
      { type: 'escape', name: 'Lose the cops', wanted: 0 },
    ],
  },
  {
    id: 'sprint',
    name: 'Sunset Sprint',
    reward: 600,
    xp: 600,
    brief: 'A street race at sunset. Hit every checkpoint before the clock runs out.',
    stages: [
      { type: 'goto', name: 'Reach the start line', x: 0, z: 160, radius: 8 },
      { type: 'race', name: 'Race the checkpoints', checkpoints: RACE_CHECKPOINTS, gold: RACE_GOLD_SECONDS, silver: RACE_SILVER_SECONDS },
    ],
  },
  {
    id: 'market',
    name: 'Night Market Heat',
    reward: 700,
    xp: 700,
    brief: 'Clear the gang out of the Night Market, then lose the cops.',
    stages: [
      { type: 'goto', name: 'Reach the Night Market', x: -160, z: 160, radius: 8 },
      { type: 'eliminate', name: 'Take out the gang', count: 5, area: MARKET_CENTER },
      { type: 'escape', name: 'Lose the cops', wanted: 0 },
    ],
  },
];

// Day and night. The clock starts at sunset, 17:30, and one game hour
// passes every real minute. Keyframes lerp the sun, the fog and the sky.
export const DAY_START_HOUR = 17.5;
export const DAY_HOURS_PER_MINUTE = 1;
export const DAY_KEYS = [
  { h: 0, sun: 0x223355, sunI: 0.15, fog: 0x0a0e1a, sky: 0x05070f, hemi: 0x1a2438 },
  { h: 6, sun: 0xff9a5c, sunI: 0.7, fog: 0x2a2a3a, sky: 0x2a1f2e, hemi: 0x5a4a6a },
  { h: 12, sun: 0xfff2d8, sunI: 1.1, fog: 0x9db8d6, sky: 0x87b5e0, hemi: 0xbfd9ff },
  { h: 18, sun: 0xff7a2a, sunI: 0.9, fog: 0x6b4a52, sky: 0x3a2530, hemi: 0x8a5a4a },
  { h: 24, sun: 0x223355, sunI: 0.15, fog: 0x0a0e1a, sky: 0x05070f, hemi: 0x1a2438 },
];

// The four staged screenshots the kit takes, in the order the dossier
// shows them. The first by name is the cover.
export const SHOTS = [
  { name: '1-drive.jpg', query: '?shot=drive&seed=1' },
  { name: '2-chase.jpg', query: '?shot=chase&seed=1' },
  { name: '3-mission.jpg', query: '?shot=mission&seed=1' },
  { name: '4-start.jpg', query: '?shot=start&seed=1' },
];
