// Procedural WebAudio for Vice Rush: no audio files, everything is
// synthesised — engine hum, gunshots, punches, coin chimes and UI clicks.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._engineOsc = null;
    this._engineGain = null;
    this._noiseBuf = null;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const len = this.ctx.sampleRate * 0.5;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this._engineGain) this._engineGain.gain.value = 0;
    return this.muted;
  }

  _tone(freq, dur, type = 'sine', vol = 0.15, when = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* audio is best-effort */ }
  }

  _noise(dur, vol = 0.2, filterFreq = 1200) {
    if (!this.ctx || this.muted || !this._noiseBuf) return;
    try {
      const t0 = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(t0);
      src.stop(t0 + dur);
    } catch { /* audio is best-effort */ }
  }

  click() {
    this._tone(660, 0.07, 'square', 0.06);
  }

  shoot() {
    this._noise(0.12, 0.3, 3000);
    this._tone(180, 0.08, 'square', 0.12);
  }

  punch() {
    this._noise(0.08, 0.18, 500);
  }

  coin() {
    this._tone(988, 0.09, 'sine', 0.14);
    this._tone(1319, 0.16, 'sine', 0.14, 0.08);
  }

  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.18, 'triangle', 0.14, i * 0.11));
  }

  wantedUp() {
    this._tone(440, 0.14, 'sawtooth', 0.08);
    this._tone(587, 0.14, 'sawtooth', 0.08, 0.14);
  }

  engine(speed01, on) {
    if (!this.ctx) return;
    try {
      if (!on || this.muted) {
        if (this._engineGain) this._engineGain.gain.value = 0;
        return;
      }
      if (!this._engineOsc) {
        this._engineOsc = this.ctx.createOscillator();
        this._engineGain = this.ctx.createGain();
        this._engineOsc.type = 'sawtooth';
        this._engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        this._engineOsc.connect(filter);
        filter.connect(this._engineGain);
        this._engineGain.connect(this.ctx.destination);
        this._engineOsc.start();
      }
      this._engineOsc.frequency.value = 55 + speed01 * 110;
      this._engineGain.gain.value = 0.02 + speed01 * 0.035;
    } catch { /* audio is best-effort */ }
  }
}
