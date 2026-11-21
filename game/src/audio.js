// Procedural sound for Vice Rush. Nothing is sampled: every effect is
// a few oscillators and noise buffers built in WebAudio, so the game
// ships no audio files and never fetches one. If the browser has no
// audio (or the player has not clicked yet) every call is a safe no-op.

class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Call from the first user gesture. Browsers block audio before that.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.startMusic();
    } catch (e) {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      this.ctx.suspend();
      if (!this.muted) this.ctx.resume();
    }
    return this.muted;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol || 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* audio is decoration, never fatal */ }
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      let node = src;
      if (lowpass) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowpass;
        src.connect(filter);
        node = filter;
      }
      node.connect(gain).connect(this.ctx.destination);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  shoot() {
    this.noise(0.12, 0.35, 3000);
    this.tone(180, 0.08, 'square', 0.12, 60);
  }

  punch() {
    this.noise(0.08, 0.25, 900);
  }

  hit() {
    this.tone(120, 0.15, 'sawtooth', 0.15, 70);
  }

  pickup() {
    this.tone(660, 0.12, 'sine', 0.18);
    setTimeout(() => this.tone(880, 0.18, 'sine', 0.18), 90);
  }

  checkpoint() {
    this.tone(520, 0.1, 'sine', 0.2);
    setTimeout(() => this.tone(780, 0.14, 'sine', 0.2), 80);
  }

  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.2), i * 110));
  }

  busted() {
    this.tone(220, 0.5, 'sawtooth', 0.15, 110);
  }

  click() {
    this.tone(440, 0.06, 'square', 0.08);
  }

  // The engine is one detuned sawtooth whose pitch follows the speed.
  engine(speed, top) {
    if (!this.ctx || this.muted) return;
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        this.engineOsc.connect(filter).connect(this.engineGain).connect(this.ctx.destination);
        this.engineOsc.start();
      }
      const ratio = Math.max(0, Math.min(1, speed / (top || 40)));
      this.engineOsc.frequency.setTargetAtTime(50 + ratio * 140, this.ctx.currentTime, 0.05);
      this.engineGain.gain.setTargetAtTime(speed > 0.5 ? 0.05 + ratio * 0.05 : 0.015, this.ctx.currentTime, 0.1);
    } catch (e) { /* ignore */ }
  }

  // A two-tone siren that follows the wanted level.
  siren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.04;
        this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
        this.sirenOsc.start();
        this.sirenOsc.frequency.setValueAtTime(700, this.ctx.currentTime);
      }
      if (this.sirenOsc) {
        const t = this.ctx.currentTime;
        const f = this.sirenOsc.frequency;
        f.cancelScheduledValues(t);
        if (on) {
          f.setValueAtTime(700, t);
          f.linearRampToValueAtTime(950, t + 0.4);
          f.linearRampToValueAtTime(700, t + 0.8);
        } else {
          this.sirenGain.gain.setTargetAtTime(0, t, 0.1);
        }
      }
    } catch (e) { /* ignore */ }
  }

  // A slow sunset chord loop: three soft oscillators drifting through a
  // four-chord progression, quiet enough to sit under the engine.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [
      [220.0, 261.6, 329.6],
      [174.6, 220.0, 261.6],
      [196.0, 246.9, 293.7],
      [146.8, 220.0, 293.7],
    ];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const chord = chords[this.musicStep % chords.length];
      this.musicStep++;
      chord.forEach((freq) => this.tone(freq, 2.4, 'sine', 0.03));
    }, 2400);
  }
}

export const audio = new GameAudio();
