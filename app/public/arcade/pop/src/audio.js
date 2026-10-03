// What's Poppin — Audio Engine
// All sounds synthesized via Web Audio API — zero external files
// Vibe: satisfying pops, rising tones on combos, bass on big streaks, lo-fi ambient

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
    this.bgPlaying = false;
    this.bgNodes = [];
    this.muted = false;

    // Pentatonic scale for melodic pop sounds — always sounds good
    // D minor pentatonic for that moody, hip-hop feel
    this.scale = [293.66, 349.23, 392.00, 440.00, 523.25, 587.33, 698.46, 783.99];
    this.popIndex = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.6;
      this.masterGain.connect(this.ctx.destination);

      // Compressor to keep everything glued
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Toggle mute on/off. Persists preference via SafeStorage. */
  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime);
    }
    if (typeof SafeStorage !== 'undefined') {
      SafeStorage.set('whatspoppin_muted', this.muted ? '1' : '0');
    }
    return this.muted;
  }

  /** Restore mute state from SafeStorage after init. */
  restoreMuteState() {
    if (typeof SafeStorage !== 'undefined') {
      this.muted = SafeStorage.get('whatspoppin_muted', '0') === '1';
      if (this.muted && this.masterGain) {
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
    }
  }

  // -------------------------------------------------------
  // TONE HELPER — eliminates oscillator+gain boilerplate
  // -------------------------------------------------------
  /**
   * Create a single oscillator voice with gain envelope.
   * Covers the repeated create→connect→schedule→stop pattern.
   * @param {number} t        — start time (AudioContext.currentTime)
   * @param {object} opts     — voice parameters
   * @param {string}  opts.type      — oscillator type ('sine', 'triangle', 'sawtooth', 'square')
   * @param {number}  opts.freq      — starting frequency
   * @param {number} [opts.freqEnd]  — if set, exponentialRamp frequency to this value
   * @param {number} [opts.freqTime] — ramp duration for freqEnd (relative to t)
   * @param {number}  opts.vol       — starting gain value
   * @param {number}  opts.dur       — total voice duration (gain ramps to 0.001 over this)
   * @param {number} [opts.attack]   — if set, gain ramps UP from 0.001 to vol over this time
   * @param {boolean} [opts.track]   — if true, push to bgNodes for cleanup
   * @returns {OscillatorNode} the started oscillator (for further manipulation)
   */
  _tone(t, { type = 'sine', freq, freqEnd, freqTime, vol, dur, attack, track } = {}) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, t + (freqTime || dur));
    }
    if (attack) {
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(vol, t + attack);
    } else {
      gain.gain.setValueAtTime(vol, t);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(t);
    osc.stop(t + dur + 0.01);
    if (track) this.bgNodes.push(osc);
    return osc;
  }

  // -------------------------------------------------------
  // BUBBLE SELECT — soft click
  // -------------------------------------------------------
  playSelect() {
    if (!this.initialized) return;
    this._tone(this.ctx.currentTime, {
      type: 'sine', freq: 800, freqEnd: 1200, freqTime: 0.06,
      vol: 0.15, dur: 0.1,
    });
  }

  // -------------------------------------------------------
  // BUBBLE POP — melodic, pitch rises with combo chain
  // -------------------------------------------------------
  playPop(streak = 1, bubbleIndex = 0) {
    if (!this.initialized) return;
    const t = this.ctx.currentTime + bubbleIndex * 0.04;

    // Pick note from scale — rises with streak for satisfying escalation
    const noteIdx = Math.min(this.popIndex % this.scale.length, this.scale.length - 1);
    const freq = this.scale[noteIdx] * (1 + streak * 0.05);
    this.popIndex++;

    // Main pop tone
    this._tone(t, { type: 'triangle', freq, freqEnd: freq * 1.5, freqTime: 0.08, vol: 0.2, dur: 0.15 });

    // Pop noise burst — the "crunch"
    this.playNoiseBurst(t, 0.06, 0.12);

    // Extra harmonics on higher streaks
    if (streak >= 3) {
      this._tone(t, { type: 'sine', freq: freq * 2, vol: 0.08, dur: 0.12 });
    }
  }

  // -------------------------------------------------------
  // NOISE BURST — used for pop texture
  // -------------------------------------------------------
  playNoiseBurst(startTime, duration, volume) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 1.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  // -------------------------------------------------------
  // STREAK HIT — escalating impact sounds
  // -------------------------------------------------------
  playStreakHit(streak) {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    this.popIndex = 0; // Reset melodic sequence for next chain

    if (streak >= 12) {
      this.playLegendary(now);
    } else if (streak >= 8) {
      this.playGodlike(now);
    } else if (streak >= 5) {
      this.playFire(now);
    } else if (streak >= 3) {
      this.playNice(now);
    }
  }

  // 3-streak: quick vinyl scratch + chord
  playNice(t) {
    // Rising chord
    [1, 1.25, 1.5].forEach((mult, i) => {
      this._tone(t + i * 0.03, { type: 'triangle', freq: 440 * mult, vol: 0.1, dur: 0.3 });
    });
    // Quick scratch noise
    this.playNoiseBurst(t, 0.08, 0.15);
  }

  // 5-streak: 808 kick + rising synth
  playFire(t) {
    // 808 sub kick
    this._tone(t, { type: 'sine', freq: 150, freqEnd: 40, freqTime: 0.2, vol: 0.4, dur: 0.3 });
    // Rising synth sweep
    this._tone(t, { type: 'sawtooth', freq: 200, freqEnd: 800, freqTime: 0.25, vol: 0.08, dur: 0.3 });
    // Hi-hat
    this.playNoiseBurst(t + 0.05, 0.04, 0.2);
    this.playNoiseBurst(t + 0.12, 0.03, 0.15);
  }

  // 8-streak: heavy 808, anime slash, power chord
  playGodlike(t) {
    // HEAVY sub bass
    this._tone(t, { type: 'sine', freq: 200, freqEnd: 30, freqTime: 0.4, vol: 0.5, dur: 0.5 });
    // Anime slash — fast descending noise
    this.playNoiseBurst(t, 0.12, 0.3);
    // Power chord stab
    [329.63, 415.30, 493.88, 659.25].forEach((freq) => {
      this._tone(t + 0.02, { type: 'square', freq, vol: 0.06, dur: 0.4 });
    });
    // Metallic ring
    this._tone(t, { type: 'sine', freq: 2400, vol: 0.05, dur: 0.6 });
  }

  // 12-streak: full cinematic — bass drop, reverse cymbal, chord swell
  playLegendary(t) {
    // MASSIVE bass drop
    this._tone(t, { type: 'sine', freq: 300, freqEnd: 25, freqTime: 0.6, vol: 0.6, dur: 0.8 });

    // Distorted sub layer (needs waveshaper — manual wiring)
    const dist = this.ctx.createOscillator();
    const distGain = this.ctx.createGain();
    const waveshaper = this.ctx.createWaveShaper();
    waveshaper.curve = this.makeDistortionCurve(80);
    dist.type = 'sine';
    dist.frequency.setValueAtTime(55, t);
    distGain.gain.setValueAtTime(0.15, t);
    distGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    dist.connect(waveshaper);
    waveshaper.connect(distGain);
    distGain.connect(this.compressor);
    dist.start(t);
    dist.stop(t + 0.7);

    // Reverse cymbal swell (noise buffer — not an oscillator)
    const swellDuration = 0.5;
    const swellBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * swellDuration, this.ctx.sampleRate);
    const swellData = swellBuffer.getChannelData(0);
    for (let i = 0; i < swellData.length; i++) {
      swellData[i] = (Math.random() * 2 - 1) * Math.pow(i / swellData.length, 2);
    }
    const swell = this.ctx.createBufferSource();
    swell.buffer = swellBuffer;
    const swellFilter = this.ctx.createBiquadFilter();
    swellFilter.type = 'highpass';
    swellFilter.frequency.setValueAtTime(2000, t);
    swellFilter.frequency.linearRampToValueAtTime(8000, t + swellDuration);
    const swellGain = this.ctx.createGain();
    swellGain.gain.setValueAtTime(0.001, t);
    swellGain.gain.linearRampToValueAtTime(0.25, t + swellDuration * 0.8);
    swellGain.gain.exponentialRampToValueAtTime(0.001, t + swellDuration);
    swell.connect(swellFilter);
    swellFilter.connect(swellGain);
    swellGain.connect(this.compressor);
    swell.start(t);

    // Triumphant chord at peak — attack envelope for swell-in
    const chordTime = t + 0.15;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq) => {
      this._tone(chordTime, { type: 'triangle', freq, vol: 0.08, dur: 0.8, attack: 0.1 });
    });
  }

  // -------------------------------------------------------
  // INVALID MOVE — dull thud
  // -------------------------------------------------------
  playInvalid() {
    if (!this.initialized) return;
    this._tone(this.ctx.currentTime, {
      type: 'sine', freq: 200, freqEnd: 80, freqTime: 0.15, vol: 0.15, dur: 0.2,
    });
  }

  // -------------------------------------------------------
  // BUBBLE LAND — soft thump when bubbles drop into place
  // -------------------------------------------------------
  playLand(delay = 0) {
    if (!this.initialized) return;
    this._tone(this.ctx.currentTime + delay, {
      type: 'sine', freq: 120, freqEnd: 60, freqTime: 0.08, vol: 0.06, dur: 0.1,
    });
  }

  // -------------------------------------------------------
  // SHUFFLE — whoosh
  // -------------------------------------------------------
  playShuffle() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;

    // Whoosh noise sweep
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(500, now + 0.4);
    filter.Q.value = 2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.4);
  }

  // -------------------------------------------------------
  // BACKGROUND BEAT — lo-fi hip-hop loop
  // -------------------------------------------------------
  startBgBeat() {
    if (!this.initialized || this.bgPlaying) return;
    this.bgPlaying = true;
    this.bgLoop();
  }

  stopBgBeat() {
    this.bgPlaying = false;
    this.bgNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    this.bgNodes = [];
  }

  bgLoop() {
    if (!this.bgPlaying) return;
    const now = this.ctx.currentTime;
    const bpm = 75; // Lo-fi tempo
    const beat = 60 / bpm;
    const bar = beat * 4;

    // Kick pattern: 1, 2.5, 3
    [0, beat * 1.5, beat * 2].forEach(t => {
      this.bgKick(now + t);
    });

    // Hi-hat on every half beat, slightly swung
    for (let i = 0; i < 8; i++) {
      const swing = i % 2 === 1 ? 0.02 : 0;
      const vol = i % 2 === 0 ? 0.06 : 0.03;
      this.bgHihat(now + i * (beat / 2) + swing, vol);
    }

    // Snare on 2 and 4
    this.bgSnare(now + beat);
    this.bgSnare(now + beat * 3);

    // Sub bass note — changes every 2 bars
    const bassNotes = [55, 65.41, 73.42, 61.74]; // A1, C2, D2, B1
    const noteIdx = Math.floor((now / (bar * 2)) % bassNotes.length);
    this.bgBass(now, bassNotes[noteIdx], bar);

    // Schedule next bar
    const nextTime = (bar * 1000) - 50; // Slight early to prevent gaps
    this.bgTimeout = setTimeout(() => this.bgLoop(), nextTime);
  }

  bgKick(t) {
    this._tone(t, { type: 'sine', freq: 100, freqEnd: 35, freqTime: 0.12, vol: 0.2, dur: 0.2, track: true });
  }

  bgHihat(t, vol = 0.05) {
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 8);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    noise.start(t);
    noise.stop(t + 0.05);
    this.bgNodes.push(noise);
  }

  bgSnare(t) {
    // Noise body
    this.playNoiseBurst(t, 0.1, 0.1);
    // Tonal snap
    this._tone(t, { type: 'triangle', freq: 200, vol: 0.08, dur: 0.06, track: true });
  }

  bgBass(t, freq, duration) {
    this._tone(t, { type: 'sine', freq, vol: 0.12, dur: duration, track: true });
  }

  // -------------------------------------------------------
  // UTILITY
  // -------------------------------------------------------
  makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
}

// Global instance
window.audioEngine = new AudioEngine();
