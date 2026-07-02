/* ============================================================
   audio.js — AudioManager
   All sound is synthesised at runtime with the Web Audio API, so the
   game ships with zero binary assets and still has effects + music.
   Browsers require a user gesture before audio can start, so the
   context is created lazily and resumed on first interaction.
   ============================================================ */

BUZZY.AudioManager = class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = BUZZY.Storage.isMuted();
    this.musicTimer = null;
    this.started = false;
    this._noiseBuffer = null;
  }

  /** Create the AudioContext. Safe to call multiple times. */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // audio unsupported — game still playable
    this.ctx = new AC();

    // Gain graph: sfx + music -> master -> destination.
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.9;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.25;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(this.masterGain);

    // Pre-render a short noise buffer used for "spray" / crash textures.
    this._noiseBuffer = this._makeNoise(0.4);
  }

  /** Resume the context after a user gesture (autoplay policy). */
  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    this.started = true;
  }

  setMuted(muted) {
    this.muted = muted;
    BUZZY.Storage.setMuted(muted);
    if (this.masterGain) {
      // Smooth ramp avoids clicks when toggling.
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.9, now + 0.08);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /* -------------------------------------------------------------
     Low-level synth helpers
     ------------------------------------------------------------- */

  // A single enveloped oscillator "blip".
  _tone(freq, dur, type = "sine", gain = 0.5, destination = null, slideTo = null) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);

    // Quick attack, exponential decay for a plucky arcade feel.
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(destination || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Build a white-noise AudioBuffer for percussive/spray effects.
  _makeNoise(seconds) {
    if (!this.ctx) return null;
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _noise(dur, gain = 0.4, filterFreq = 1000) {
    if (!this.ctx || !this._noiseBuffer) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur);
  }

  /* -------------------------------------------------------------
     Named sound effects
     ------------------------------------------------------------- */

  nectar() {
    // Cheerful rising two-note chime.
    this._tone(660, 0.12, "triangle", 0.5);
    this._tone(990, 0.16, "triangle", 0.4, null, 1320);
  }

  bigNectar() {
    // Richer arpeggio for high-value flowers.
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.14, "triangle", 0.45), i * 55);
    });
  }

  powerup() {
    this._tone(523, 0.1, "square", 0.35, null, 1046);
    setTimeout(() => this._tone(1046, 0.18, "square", 0.3, null, 1568), 80);
  }

  hit() {
    // Buzzy downward crunch.
    this._tone(220, 0.25, "sawtooth", 0.5, null, 60);
    this._noise(0.2, 0.35, 800);
  }

  shieldBlock() {
    this._tone(300, 0.15, "square", 0.4, null, 500);
    this._noise(0.12, 0.2, 2000);
  }

  gameOver() {
    const notes = [523, 440, 349, 262];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, 0.3, "triangle", 0.5), i * 180));
  }

  achievement() {
    [659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.18, "square", 0.35), i * 90)
    );
  }

  click() {
    this._tone(500, 0.06, "square", 0.25);
  }

  /* -------------------------------------------------------------
     Background music — a gentle looping bassline + melody built from
     a scale, scheduled with setInterval. Tempo nudges up slightly as
     difficulty rises to keep energy building.
     ------------------------------------------------------------- */

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // C major pentatonic-ish scale for a happy meadow vibe.
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const bass = [130.81, 146.83, 164.81, 196.0];
    let step = 0;
    this._tempo = 300; // ms per step, adjustable via setMusicIntensity

    const playStep = () => {
      if (!this.ctx || this.muted) return; // still schedule, just stay quiet
      // Melody note every step; bass note every 4 steps.
      const note = scale[BUZZY.Utils.randInt(0, scale.length - 1)];
      this._tone(note, 0.22, "triangle", 0.18, this.musicGain);
      if (step % 4 === 0) {
        this._tone(bass[(step / 4) % bass.length], 0.5, "sine", 0.22, this.musicGain);
      }
      step++;
    };

    this.musicTimer = setInterval(playStep, this._tempo);
  }

  // Speed the music up a touch as the game gets harder (0..1 intensity).
  setMusicIntensity(t) {
    if (!this.musicTimer) return;
    const newTempo = Math.round(BUZZY.Utils.lerp(300, 190, BUZZY.Utils.clamp(t, 0, 1)));
    if (newTempo !== this._tempo) {
      this._tempo = newTempo;
      clearInterval(this.musicTimer);
      this.musicTimer = null;
      // Restart at the new tempo.
      const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
      const bass = [130.81, 146.83, 164.81, 196.0];
      let step = 0;
      this.musicTimer = setInterval(() => {
        if (!this.ctx || this.muted) return;
        this._tone(scale[BUZZY.Utils.randInt(0, scale.length - 1)], 0.22, "triangle", 0.18, this.musicGain);
        if (step % 4 === 0) this._tone(bass[(step / 4) % bass.length], 0.5, "sine", 0.22, this.musicGain);
        step++;
      }, this._tempo);
    }
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
};
