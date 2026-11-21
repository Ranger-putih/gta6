// Vice Rush — tuning and world constants.
// One place holds every number the game is balanced around, so a change to a
// mission, a speed or a price happens here and nowhere else.

export const CONFIG = {
  // The city is a square. Roads run both ways at these x and z coordinates.
  world: {
    half: 200,
    roads: [-160, -80, 0, 80, 160],
    roadWidth: 12,
    sidewalkWidth: 4,
    // East of x = 200 the land gives way to sand, then the sea.
    beachAt: 200,
    seaAt: 236,
    // A fixed seed keeps the city identical on every load.
    seed: 7,
  },

  player: {
    start: { x: 10, z: 24, heading: Math.PI },
    walkSpeed: 6,
    runSpeed: 10.5,
    radius: 0.55,
    health: 100,
    startMoney: 150,
  },

  // Fixed landmarks. The Beach Cafe and the garage are mission landmarks, so
  // their boxes and their markers are defined together here and nowhere else.
  // A marker must never sit inside its building's box: the cafe box spans
  // z -46..-34, so the mission 1 marker sits at z -30, clear of it on the sand;
  // the garage box spans z 161..175, so the mission 2 marker sits at z 152.
  cafe: { x: 208, z: -40, w: 16, d: 12, h: 7 },
  mission1Target: { x: 208, z: -30 },
  garage: { x: -168, z: 168, w: 18, d: 14, h: 8 },
  mission2Target: { x: -168, z: 152 },
  sportsCar: { x: -80, z: -168, heading: Math.PI / 2 },

  // Parked cars the player can steal, placed on roads around the city.
  parkedCars: [
    { x: 192, z: 120, heading: Math.PI, color: 0xb03a2e, name: 'Crimson Coupe' },
    { x: -84, z: 84, heading: 0, color: 0x2e6db0, name: 'Blue Sedan' },
    { x: 84, z: -84, heading: Math.PI, color: 0x3f8f5f, name: 'Green Hatchback' },
    { x: -164, z: -84, heading: Math.PI / 2, color: 0xd8d8d8, name: 'White Van' },
    { x: 164, z: 164, heading: -Math.PI / 2, color: 0x8a5fc0, name: 'Purple Coupe' },
  ],

  cars: {
    // Arcade handling numbers for the player's car.
    accel: 22,
    brake: 34,
    reverseAccel: 12,
    maxSpeed: 42,
    maxReverse: 10,
    drag: 0.55,
    steerRate: 1.9,
    // Traffic cars cruise slower and never reverse.
    trafficSpeed: 11,
    trafficCount: 10,
    policeSpeed: 46,
    policeCount: 5,
  },

  pedestrians: {
    count: 14,
    walkSpeed: 1.6,
  },

  wanted: {
    // Crimes and how many stars they add.
    stealCar: 1,
    hitPedestrian: 1,
    shoot: 1,
    punchCop: 2,
    // Wanted fades when no police car is close for this long.
    decayAfterSeconds: 14,
    decayPerSecond: 0.25,
    // A cop this close, for this long, busts the player.
    bustRadius: 3.2,
    bustSeconds: 2.2,
  },

  missions: [
    {
      id: 'package',
      title: 'Package for Mira',
      brief: 'Mira needs a package at the Beach Cafe. Reach the yellow marker and press E.',
      type: 'reach',
      target: { x: 208, z: -30 },
      radius: 5,
      reward: 300,
    },
    {
      id: 'steal',
      title: "Dito's Ride",
      brief: "Steal Dito's yellow sports car, then deliver it to the garage marker.",
      type: 'steal-deliver',
      carAt: { x: -80, z: -168 },
      target: { x: -168, z: 152 },
      radius: 6,
      reward: 500,
    },
    {
      id: 'escape',
      title: 'Lose the Heat',
      brief: 'The cops are on you. Break line of sight and get your wanted level to zero.',
      type: 'escape',
      reward: 400,
    },
  ],

  combat: {
    punchRange: 2.2,
    punchDamage: 34,
    punchCooldown: 0.45,
    shootRange: 60,
    shootDamage: 50,
    shootCooldown: 0.35,
    pedHealth: 100,
    copHealth: 150,
  },

  camera: {
    distance: 13,
    minDistance: 6,
    maxDistance: 26,
    height: 5.5,
    // A snap factor of 10 makes the camera settle instantly after a teleport.
    snapLerp: 10,
    followLerp: 7,
  },

  // Shot mode stages the world and steps it this many fixed steps.
  shots: {
    steps: 90,
    dt: 1 / 60,
  },
};
