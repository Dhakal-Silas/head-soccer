// Keyboard state with edge detection. The simulation runs on a fixed
// timestep, so presses are queued and consumed exactly once.

import { CONTROLS } from './config.js';

export class Input {
  constructor() {
    this.down = new Set();
    this.pressQueue = new Map(); // code -> count of un-consumed presses
    this.listeners = [];
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressQueue.set(e.code, (this.pressQueue.get(e.code) || 0) + 1);
      for (const fn of this.listeners) fn(e.code, e);
      if (this.isGameKey(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.reset());
  }

  isGameKey(code) {
    for (const map of CONTROLS) {
      for (const k of Object.keys(map)) if (map[k].includes(code)) return true;
    }
    return false;
  }

  onPress(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }

  isDown(codes) { return codes.some((c) => this.down.has(c)); }

  consumePress(codes) {
    let hit = false;
    for (const c of codes) {
      const n = this.pressQueue.get(c) || 0;
      if (n > 0) { this.pressQueue.set(c, n - 1); hit = true; }
    }
    return hit;
  }

  clearQueue() { this.pressQueue.clear(); }

  reset() { this.down.clear(); this.pressQueue.clear(); }

  /** Build the per-step command object for a human player slot (0 or 1). */
  commandFor(slot) {
    const m = CONTROLS[slot];
    return {
      left: this.isDown(m.left),
      right: this.isDown(m.right),
      jump: this.isDown(m.jump) || this.consumePress(m.jump),
      kick: this.consumePress(m.kick),
      speedScale: 1,
    };
  }
}
