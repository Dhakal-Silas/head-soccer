// Procedural sound effects with WebAudio: no asset files needed.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.crowdGain = null;
    this.crowdTarget = 0;
    this.muted = localStorage.getItem('hs3d.muted') === '1';
    this.unlocked = false;
    this.lastBounce = 0;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.buildCrowd();
      this.unlocked = true;
    } catch (e) {
      console.warn('Audio unavailable', e);
    }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('hs3d.muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  noiseBuffer(seconds = 2) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // brown-ish noise
      d[i] = last * 3.5;
    }
    return buf;
  }

  buildCrowd() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    this.crowdGain = g;
    this.crowdFilter = lp;
  }

  /** 0..1 ambient crowd level, smoothly approached. */
  setCrowd(level) {
    if (!this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(level * 0.35, this.ctx.currentTime, 0.4);
  }

  tone({ freq = 440, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005, decay = null, slide = null, delay = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay || dur));
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + (decay || dur) + 0.05);
  }

  burst({ dur = 0.2, vol = 0.4, freq = 1200, q = 1, delay = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(Math.max(0.3, dur));
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  click() { this.tone({ freq: 880, type: 'triangle', dur: 0.06, vol: 0.15 }); }
  hover() { this.tone({ freq: 1320, type: 'sine', dur: 0.03, vol: 0.05 }); }

  kick(power = 1) {
    this.burst({ dur: 0.12, vol: 0.35 * power, freq: 300, q: 0.7 });
    this.tone({ freq: 140, type: 'sine', dur: 0.12, vol: 0.4 * power, slide: 60 });
  }

  bounce(strength = 1) {
    const now = performance.now();
    if (now - this.lastBounce < 40) return;
    this.lastBounce = now;
    const v = Math.min(1, strength);
    this.tone({ freq: 220 + 80 * v, type: 'sine', dur: 0.08, vol: 0.25 * v, slide: 90 });
  }

  head(strength = 1) {
    this.tone({ freq: 400, type: 'square', dur: 0.05, vol: 0.12 * Math.min(1, strength) , slide: 200 });
    this.burst({ dur: 0.08, vol: 0.2 * Math.min(1, strength), freq: 800 });
  }

  jump() { this.tone({ freq: 300, type: 'triangle', dur: 0.12, vol: 0.08, slide: 600 }); }

  whistle(long = false) {
    const d = long ? 0.9 : 0.35;
    this.tone({ freq: 2650, type: 'square', dur: d, vol: 0.12, attack: 0.01 });
    this.tone({ freq: 2680, type: 'sawtooth', dur: d, vol: 0.05, attack: 0.01 });
    if (long) {
      this.tone({ freq: 2650, type: 'square', dur: 0.25, vol: 0.12, delay: 1.0 });
      this.tone({ freq: 2650, type: 'square', dur: 0.25, vol: 0.12, delay: 1.35 });
    }
  }

  countdown(final = false) {
    this.tone({ freq: final ? 1320 : 660, type: 'square', dur: final ? 0.35 : 0.12, vol: 0.12 });
  }

  goal() {
    this.burst({ dur: 1.8, vol: 0.5, freq: 700, q: 0.4 });
    this.burst({ dur: 2.4, vol: 0.3, freq: 1500, q: 0.5, delay: 0.1 });
    if (this.crowdGain) {
      const t = this.ctx.currentTime;
      this.crowdGain.gain.cancelScheduledValues(t);
      this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
      this.crowdGain.gain.linearRampToValueAtTime(0.9, t + 0.2);
      this.crowdGain.gain.linearRampToValueAtTime(0.35, t + 2.5);
    }
  }

  fanfare() {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.2, delay: i * 0.14 }));
    this.burst({ dur: 2.5, vol: 0.4, freq: 900, q: 0.4 });
  }

  lose() {
    const notes = [392, 370, 349, 330];
    notes.forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', dur: 0.35, vol: 0.12, delay: i * 0.3 }));
  }
}
