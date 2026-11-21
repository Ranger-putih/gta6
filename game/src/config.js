// Vice Rush — every tuning number, colour and mission in one place.
// The city is a road grid: roads run at the centres listed in CITY.roads,
// blocks sit between them. East of x = beachX is sand, then the sea.
export const STEP = 1 / 60;

/** Where the save (money, missions, best) is kept between visits. */
export const SAVE_KEY = 'vice-rush.save.v1';

export const CITY = {
  pitch: 80,
  road: 16,
  roads: [-160, -80, 0, 80, 160],
  half: 200,
  beachX: 200,
  sandEnd: 238,
  seaX: 238,
  groundMinX: -320,
  groundMaxX: 460,
  groundMinZ: -320,
  groundMaxZ: 320,
};

export const PALETTE = {
  sky: 0xff9e57,
  fog: 0xdd875f,
  ground: 0x3a3f4a,
  road: 0x2e323d,
  sidewalk: 0x8d8578,
  sand: 0xe8cf9a,
  sea: 0x1f6f8b,
  building: [0xf2d8a7, 0xe8b48c, 0xc9d6df, 0xf6e3c5, 0xd9a441, 0x9fb8c8, 0xe07856, 0x7fb069],
  windowLit: 0xffd27a,
  windowDark: 0x2c3550,
  palm: 0x2e7d4f,
  trunk: 0x7a5230,
  lamp: 0xffe9a8,
  player: 0x4fc3f7,
  police: 0x2b4acb,
  taxi: 0xf2c94c,
};

export const TUNE = {
  walkSpeed: 6,
  runSpeed: 10.5,
  playerRadius: 0.7,
  carRadius: 2.3,
  carAccel: 17,
  carBrake: 30,
  carReverse: 11,
  carMax: 40,
  sportsMax: 50,
  steerRate: 2.0,
  wantedDecaySeconds: 26,
  policeRamDamage: 9,
  policeShootDamage: 4,
  punchDamage: 25,
  gunDamage: 40,
  gunRange: 60,
  bustSeconds: 2.5,
  healthRegen: 2.5,
};

/** The story, in three jobs for Raka, new in town and working for Mira. */
export const MISSIONS = [
  {
    id: 'package',
    title: 'Package for Mira',
    brief: 'Mira needs a package at the Beach Cafe. Reach the yellow marker and press E.',
    target: { x: 208, z: -40 },
    radius: 5,
    reward: 300,
    type: 'reach',
  },
  {
    id: 'steal',
    title: "Dito's Ride",
    brief: 'Steal the yellow sports car at the north lot, then bring it to the garage marker. The cops will notice.',
    target: { x: -80, z: -168 },
    garage: { x: -168, z: 168 },
    radius: 6,
    reward: 500,
    type: 'steal-deliver',
  },
  {
    id: 'escape',
    title: 'Lose the Heat',
    brief: 'Raise your wanted level to 3 stars, then lose the cops until it drops back to zero.',
    target: null,
    radius: 0,
    reward: 400,
    type: 'escape',
  },
];

export const PLAYER_START = { x: 10, z: 24, heading: Math.PI };

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
