// All sound is synthesised with WebAudio: engine hum, police sirens, impacts,
// pickups and a small bass-and-hat music loop. No audio files are loaded.
// Everything is a no-op until unlock() runs on a user gesture, so the shot
// scenes (which have no gesture) stay silent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let engine = null;
  let siren = null;
  let sirenTimer = null;
  let sirenHigh = false;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  /** Bass notes of the loop, in Hz (A minor walk), 0 is a rest. */
  const BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 73.42];
  const MUSIC_STEP_MS = 210;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gainValue, slideTo) {
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Sound never breaks the game.
    }
  }

  function noise(dur, gainValue, filterFreq) {
    if (!ctx) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
      src.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Sound never breaks the game.
    }
  }

  return {
    /** Call on the first click or keypress: browsers need a gesture. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine hum that follows the car's speed (0 to 1). */
    engine(speed01, on) {
      if (!ctx || !on) {
        if (engine) engine.gain.gain.value = 0;
        return;
      }
      try {
        if (!engine) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 700;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(master);
          osc.start();
          engine = { osc, gain };
        }
        engine.osc.frequency.value = 55 + speed01 * 165;
        engine.gain.gain.value = 0.035 + speed01 * 0.045;
      } catch {
        // Sound never breaks the game.
      }
    },
    /** Two-tone police siren, on or off. */
    siren(on) {
      if (!ctx) return;
      try {
        if (on && !siren) {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.value = 720;
          const gain = ctx.createGain();
          gain.gain.value = 0.035;
          osc.connect(gain);
          gain.connect(master);
          osc.start();
          siren = { osc, gain };
          sirenTimer = window.setInterval(() => {
            sirenHigh = !sirenHigh;
            if (siren) siren.osc.frequency.value = sirenHigh ? 960 : 720;
          }, 340);
        } else if (!on && siren) {
          window.clearInterval(sirenTimer);
          sirenTimer = null;
          siren.osc.stop();
          siren = null;
        }
      } catch {
        // Sound never breaks the game.
      }
    },
    blip() {
      tone(880, 0.12, 'square', 0.12, 1320);
    },
    thud() {
      tone(130, 0.16, 'sine', 0.25, 45);
      noise(0.1, 0.15, 300);
    },
    shot() {
      noise(0.14, 0.3, 1800);
      tone(220, 0.08, 'square', 0.12, 60);
    },
    crash() {
      noise(0.3, 0.3, 500);
      tone(90, 0.25, 'sine', 0.2, 40);
    },
    jingle() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.22, 'triangle', 0.16), i * 110);
      });
    },
    busted() {
      tone(392, 0.3, 'sawtooth', 0.14, 370);
      window.setTimeout(() => tone(311, 0.5, 'sawtooth', 0.14, 294), 280);
    },
    /** Start or stop the bass-and-hat loop. */
    music(on) {
      if (!ctx) return;
      if (on && !musicTimer) {
        musicStep = 0;
        musicTimer = window.setInterval(() => {
          const note = BASS[musicStep % BASS.length];
          if (note) tone(note, 0.2, 'triangle', 0.11);
          if (musicStep % 2 === 1) noise(0.04, 0.05, 6000);
          musicStep += 1;
        }, MUSIC_STEP_MS);
      } else if (!on && musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
