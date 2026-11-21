// Procedural sound, all synthesized with WebAudio. There are no audio files:
// the engine hum, the siren, the punches, the shots and the music are all
// oscillators and filtered noise, built when the game starts.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Must be called from a user gesture (the Start button), or the browser
  // will keep the AudioContext suspended.
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // A short burst of filtered noise (a thump, a punch, a shot's crack).
  noiseBurst(duration, filterFreq, volume, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration);
  }

  // A single note from a sine/triangle oscillator, with a soft envelope.
  tone(freq, duration, type, volume, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  punch() {
    this.noiseBurst(0.12, 900, 0.5);
    this.tone(140, 0.1, 'sine', 0.4);
  }

  shoot() {
    this.noiseBurst(0.16, 3200, 0.6);
    this.tone(90, 0.18, 'sawtooth', 0.25);
  }

  // The mission-complete chime: a rising three-note arpeggio.
  chime() {
    this.tone(523.25, 0.22, 'triangle', 0.35);
    this.tone(659.25, 0.22, 'triangle', 0.35, 0.09);
    this.tone(783.99, 0.4, 'triangle', 0.4, 0.18);
  }

  pickup() {
    this.tone(880, 0.12, 'sine', 0.3);
    this.tone(1174.66, 0.2, 'sine', 0.25, 0.07);
  }

  click() {
    this.tone(1200, 0.05, 'square', 0.12);
  }

  busted() {
    this.tone(220, 0.3, 'sawtooth', 0.3);
    this.tone(174, 0.5, 'sawtooth', 0.3, 0.25);
  }

  // The car engine: a sawtooth whose pitch follows the speed. Call every
  // frame with speed01 in 0..1, or 0 to silence it.
  engine(speed01) {
    if (!this.ctx) return;
    if (speed01 <= 0.01) {
      if (this.engineOsc) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    const freq = 55 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.05, this.ctx.currentTime, 0.1);
  }

  // A two-tone police siren. Call with true while any police car is near.
  siren(on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenOsc) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
    }
    // Alternate 660 / 520 Hz on a slow LFO built from the wall clock.
    const phase = (this.ctx.currentTime % 1.2) < 0.6 ? 660 : 520;
    this.sirenOsc.frequency.setTargetAtTime(phase, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.2);
  }

  // A slow sunset groove: a four-chord pad (Am – F – C – G) with a soft bass.
  // One chord a bar, scheduled ahead so the loop never gaps.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [130.81, 196.0, 261.63],
      [196.0, 246.94, 293.66],
    ];
    const bass = [55.0, 43.65, 65.41, 49.0];
    const barSeconds = 4;
    const playBar = () => {
      if (this.muted || !this.ctx) {
        this.musicStep += 1;
        return;
      }
      const chord = chords[this.musicStep % chords.length];
      const root = bass[this.musicStep % bass.length];
      for (const freq of chord) {
        this.tone(freq, barSeconds * 0.95, 'sine', 0.05);
      }
      this.tone(root, barSeconds * 0.9, 'triangle', 0.09);
      this.musicStep += 1;
    };
    playBar();
    this.musicTimer = window.setInterval(playBar, barSeconds * 1000);
  }
}
