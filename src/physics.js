// Deterministic 2D simulation of a head-soccer match (rendered in 3D).
// Everything lives in the x/y plane; the renderer adds depth.

import { FIELD, PHYS, statMap } from './config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function makePlayerState(roster, slot) {
  const s = roster.stats;
  const headR = statMap.headRadius(s.size);
  return {
    slot,
    roster,
    x: slot === 0 ? -4 : 4,
    y: 0,
    vx: 0,
    vy: 0,
    facing: slot === 0 ? 1 : -1,
    onGround: true,
    headR,
    headH: 0.72 + headR,      // head centre above the feet
    bodyR: 0.27,
    bodyH: 0.34,
    maxSpeed: statMap.maxSpeed(s.speed),
    jumpVel: statMap.jumpVel(s.jump),
    kickPower: statMap.kickPower(s.power),
    headBounce: statMap.headBounce(s.control),
    kickT: -1,                // -1 idle, else seconds since the kick started
    kickHit: false,
    jumpBuffer: 0,
    coyote: 0,
    lastHeadHit: 0,
  };
}

export function makeBallState() {
  return { x: 0, y: 3.2, vx: 0, vy: 0, r: PHYS.ballRadius, spin: 0 };
}

/**
 * Simplified forward simulation used by the CPU to guess where the ball will
 * be when it comes down to `targetY`. Returns {x, y, t}.
 */
export function predictBall(ball, targetY, maxT = 2.2) {
  const b = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
  const dt = 1 / 60;
  const W = FIELD.halfWidth - PHYS.ballRadius;
  for (let t = 0; t < maxT; t += dt) {
    b.vy -= PHYS.ballGravity * dt;
    const drag = 1 - PHYS.ballAirDrag * dt;
    b.vx *= drag; b.vy *= drag;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < -W) { b.x = -W; b.vx = -b.vx * PHYS.wallBounce; }
    if (b.x > W) { b.x = W; b.vx = -b.vx * PHYS.wallBounce; }
    if (b.y < PHYS.ballRadius) { b.y = PHYS.ballRadius; b.vy = -b.vy * PHYS.ballBounce; if (Math.abs(b.vy) < 1) b.vy = 0; }
    if (b.y <= targetY && b.vy <= 0) return { x: b.x, y: b.y, t };
  }
  return { x: b.x, y: b.y, t: maxT };
}

/**
 * Where/when the ball crosses the vertical line x = lineX (used by the CPU to
 * block shots). Returns {y, t} or null when it does not cross within maxT.
 */
export function predictCross(ball, lineX, maxT = 2.0) {
  const b = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
  const dt = 1 / 60;
  const W = FIELD.halfWidth - PHYS.ballRadius;
  const side0 = Math.sign(b.x - lineX);
  if (side0 === 0) return { y: b.y, t: 0 };
  for (let t = 0; t < maxT; t += dt) {
    b.vy -= PHYS.ballGravity * dt;
    const drag = 1 - PHYS.ballAirDrag * dt;
    b.vx *= drag; b.vy *= drag;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < -W) { b.x = -W; b.vx = -b.vx * PHYS.wallBounce; }
    if (b.x > W) { b.x = W; b.vx = -b.vx * PHYS.wallBounce; }
    if (b.y < PHYS.ballRadius) { b.y = PHYS.ballRadius; b.vy = -b.vy * PHYS.ballBounce; }
    if (Math.sign(b.x - lineX) !== side0) return { y: b.y, t };
  }
  return null;
}

export class Match {
  /**
   * @param {object} settings {mode:'time'|'goals', minutes, target, goldenGoal}
   * @param {Array} rosters two roster entries
   */
  constructor(settings, rosters) {
    this.settings = settings;
    this.players = [makePlayerState(rosters[0], 0), makePlayerState(rosters[1], 1)];
    this.ball = makeBallState();
    this.score = [0, 0];
    this.time = 0;              // seconds of play
    this.phase = 'countdown';   // countdown | play | goal | ended
    this.phaseT = 0;
    this.countdownLen = 3.2;
    this.overtime = false;
    this.lastScorer = -1;
    this.winner = -1;           // -1 draw / undecided
    this.events = [];
    this.stats = { kicks: [0, 0], headers: [0, 0], possession: [0, 0] };
    this.frame = 0;
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  resetPositions() {
    for (const p of this.players) {
      p.x = p.slot === 0 ? -4 : 4; p.y = 0; p.vx = 0; p.vy = 0;
      p.facing = p.slot === 0 ? 1 : -1; p.onGround = true; p.kickT = -1; p.kickHit = false;
    }
    const b = this.ball;
    b.x = 0; b.y = 3.4; b.vx = 0; b.vy = 0; b.spin = 0;
  }

  timeLimit() { return this.settings.mode === 'time' ? this.settings.minutes * 60 : Infinity; }
  timeLeft() { return Math.max(0, this.timeLimit() - this.time); }

  /** Advance by one fixed step. commands: [{left,right,jump,kick,speedScale}, ...] */
  step(commands) {
    const dt = PHYS.dt;
    this.frame++;
    this.phaseT += dt;

    if (this.phase === 'countdown') {
      if (this.phaseT >= this.countdownLen) {
        this.phase = 'play';
        this.phaseT = 0;
        this.emit('whistle');
      }
      // players can shuffle a little but the ball is frozen
      this.stepPlayers(commands, dt, false);
      return;
    }

    if (this.phase === 'goal') {
      this.stepPlayers([{}, {}], dt, false);
      this.stepBall(dt, false);
      if (this.phaseT >= 2.6) {
        if (this.checkMatchEnd()) return;
        this.resetPositions();
        this.phase = 'countdown';
        this.countdownLen = 1.6;
        this.phaseT = 0;
        this.emit('reset');
      }
      return;
    }

    if (this.phase === 'ended') {
      this.stepPlayers([{}, {}], dt, false);
      this.stepBall(dt, false);
      return;
    }

    // ---- play ----
    this.time += dt;
    this.stepPlayers(commands, dt, true);
    this.stepBall(dt, true);
    this.collidePlayers();
    // alternate the processing order every step so neither slot gets the
    // "last write wins" advantage when both touch the ball at once
    const order = this.frame % 2 === 0 ? [0, 1] : [1, 0];
    for (const i of order) {
      const p = this.players[i];
      this.collideBallPlayer(p);
      this.kickCheck(p);
    }
    this.clampBall();
    this.checkGoal();

    // anti-stall: if the ball has barely moved for a while (wedged between
    // players, or jammed in a corner) pop it back into play
    const b = this.ball;
    if (!this.stallAnchor) this.stallAnchor = { x: b.x, y: b.y, t: this.time };
    const an = this.stallAnchor;
    if (Math.hypot(b.x - an.x, b.y - an.y) > 0.45) {
      // a nudge that only moved the ball a little does not count as escaping
      if (!(an.nudges && Math.hypot(b.x - an.x, b.y - an.y) < 1.2 && this.time - an.t < 2)) an.nudges = 0;
      an.x = b.x; an.y = b.y; an.t = this.time;
    } else {
      const resting = b.y <= b.r + 0.02 && Math.abs(b.x) < FIELD.goalX - 0.5;
      if (this.time - an.t > (resting ? 6 : 3)) {
        an.nudges = (an.nudges || 0) + 1;
        if (an.nudges >= 2) {
          // still jammed after a nudge: referee's drop ball at the centre
          b.x = 0; b.y = 3.4; b.vx = 0; b.vy = 0;
          this.stallAnchor = null;
          this.emit('drop', {});
        } else {
          b.vy = 7;
          b.vx = (Math.random() - 0.5) * 3 + (b.x > 0 ? -2 : 2);
          an.x = b.x; an.y = b.y; an.t = this.time;
          this.emit('nudge', { x: b.x, y: b.y });
        }
      }
    }

    const ballSide = this.ball.x < 0 ? 0 : 1;
    this.stats.possession[ballSide] += dt;

    if (this.settings.mode === 'time' && this.time >= this.timeLimit() && this.phase === 'play') {
      if (this.score[0] !== this.score[1]) {
        this.endMatch();
      } else if (this.settings.goldenGoal && !this.overtime) {
        this.overtime = true;
        this.emit('overtime');
      } else if (!this.settings.goldenGoal) {
        this.endMatch();
      }
    }
  }

  checkMatchEnd() {
    const s = this.score;
    if (this.settings.mode === 'goals') {
      if (s[0] >= this.settings.target || s[1] >= this.settings.target) { this.endMatch(); return true; }
    } else if (this.overtime && s[0] !== s[1]) {
      this.endMatch(); return true;
    } else if (this.time >= this.timeLimit() && s[0] !== s[1]) {
      this.endMatch(); return true;
    }
    return false;
  }

  endMatch() {
    this.phase = 'ended';
    this.phaseT = 0;
    const s = this.score;
    this.winner = s[0] === s[1] ? -1 : (s[0] > s[1] ? 0 : 1);
    this.emit('end', { winner: this.winner });
  }

  // ---------------------------------------------------------------- players
  stepPlayers(commands, dt, live) {
    for (let i = 0; i < 2; i++) {
      const p = this.players[i];
      const c = commands[i] || {};
      const scale = c.speedScale || 1;
      const want = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      const target = want * p.maxSpeed * scale;
      const ctrl = p.onGround ? 1 : PHYS.airControl;

      if (want !== 0) {
        const accel = PHYS.playerAccel * ctrl;
        if (p.vx < target) p.vx = Math.min(target, p.vx + accel * dt);
        else if (p.vx > target) p.vx = Math.max(target, p.vx - accel * dt);
      } else if (p.onGround) {
        const f = PHYS.playerFriction * dt;
        if (Math.abs(p.vx) <= f) p.vx = 0; else p.vx -= Math.sign(p.vx) * f;
      } else {
        p.vx *= 1 - 0.6 * dt;
      }

      // Always face the opponent (classic head soccer)
      const other = this.players[1 - i];
      p.facing = other.x >= p.x ? 1 : -1;

      // jumping (with a small buffer + coyote time)
      if (c.jump) p.jumpBuffer = 0.1; else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
      if (p.onGround) p.coyote = 0.08; else p.coyote = Math.max(0, p.coyote - dt);
      if (live && p.jumpBuffer > 0 && p.coyote > 0) {
        p.vy = p.jumpVel;
        p.onGround = false;
        p.coyote = 0;
        p.jumpBuffer = 0;
        this.emit('jump', { slot: i });
      }

      // kicking
      if (live && c.kick && p.kickT < 0) {
        p.kickT = 0;
        p.kickHit = false;
        this.stats.kicks[i]++;
        this.emit('swing', { slot: i });
      }
      if (p.kickT >= 0) {
        p.kickT += dt;
        if (p.kickT >= PHYS.kickDuration) p.kickT = -1;
      }

      // integrate
      p.vy -= PHYS.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // ground / net roof platforms
      const wasGround = p.onGround;
      p.onGround = false;
      const prevY = p.y - p.vy * dt;
      const onRoof = Math.abs(p.x) > FIELD.goalX + 0.15;
      if (onRoof && prevY >= FIELD.goalHeight - 0.001 && p.y < FIELD.goalHeight && p.vy <= 0) {
        p.y = FIELD.goalHeight; p.vy = 0; p.onGround = true;
      }
      if (p.y <= 0) {
        if (!wasGround && p.vy < -4) this.emit('land', { slot: i, speed: -p.vy });
        p.y = 0; p.vy = 0; p.onGround = true;
      }
      // head under the roof while inside the goal
      if (Math.abs(p.x) > FIELD.goalX + 0.1 && p.y < FIELD.goalHeight - 0.5) {
        const top = p.y + p.headH + p.headR;
        if (top > FIELD.goalHeight - 0.02 && p.vy > 0) { p.vy = 0; p.y = FIELD.goalHeight - 0.02 - p.headH - p.headR; }
      }
      // ceiling
      if (p.y + p.headH + p.headR > FIELD.ceiling) { p.y = FIELD.ceiling - p.headH - p.headR; p.vy = Math.min(0, p.vy); }

      // walls
      const minX = -FIELD.halfWidth + p.headR;
      const maxX = FIELD.halfWidth - p.headR;
      if (p.x < minX) { p.x = minX; p.vx = Math.max(0, p.vx); }
      if (p.x > maxX) { p.x = maxX; p.vx = Math.min(0, p.vx); }

      // crossbar / post as a solid point for the head
      for (const sgn of [-1, 1]) {
        const px = sgn * FIELD.goalX, py = FIELD.goalHeight;
        const hx = p.x, hy = p.y + p.headH;
        const dx = hx - px, dy = hy - py;
        const d = Math.hypot(dx, dy);
        const minD = p.headR + FIELD.postRadius;
        if (d < minD && d > 1e-6) {
          const nx = dx / d, ny = dy / d;
          p.x += nx * (minD - d);
          p.y += ny * (minD - d);
          const vn = p.vx * nx + p.vy * ny;
          if (vn < 0) { p.vx -= vn * nx; p.vy -= vn * ny; }
          if (ny > 0.7) { p.onGround = true; }
        }
      }
    }
  }

  collidePlayers() {
    const [a, b] = this.players;
    // head vs head
    const ax = a.x, ay = a.y + a.headH, bx = b.x, by = b.y + b.headH;
    let dx = bx - ax, dy = by - ay;
    let d = Math.hypot(dx, dy);
    let minD = a.headR + b.headR;
    if (d < minD) {
      if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
      const nx = dx / d, ny = dy / d;
      const push = (minD - d) / 2;
      if (Math.abs(ny) > 0.72) {
        // one player standing on the other
        const top = ny > 0 ? b : a;
        const bottom = ny > 0 ? a : b;
        top.y = bottom.y + bottom.headH + bottom.headR + top.headR - top.headH;
        if (top.vy < 0) top.vy = 0;
        top.onGround = true;
        top.coyote = 0.08;
      } else {
        a.x -= nx * push; b.x += nx * push;
        const rv = (b.vx - a.vx) * nx;
        if (rv < 0) { a.vx += rv * nx * 0.5; b.vx -= rv * nx * 0.5; }
      }
    }
    // body vs body (keeps feet from overlapping)
    dx = b.x - a.x;
    const bodyMin = a.bodyR + b.bodyR;
    if (Math.abs(dx) < bodyMin && Math.abs(a.y - b.y) < 0.6) {
      const s = dx >= 0 ? 1 : -1;
      const push = (bodyMin - Math.abs(dx)) / 2;
      a.x -= s * push; b.x += s * push;
    }
  }

  // ------------------------------------------------------------------- ball
  stepBall(dt, live) {
    const b = this.ball;
    const prevX = b.x, prevY = b.y;
    b.vy -= PHYS.ballGravity * dt;
    const drag = 1 - PHYS.ballAirDrag * dt;
    b.vx *= drag; b.vy *= drag;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > PHYS.ballMaxSpeed) { b.vx *= PHYS.ballMaxSpeed / sp; b.vy *= PHYS.ballMaxSpeed / sp; }
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // ground
    if (b.y < b.r) {
      b.y = b.r;
      if (b.vy < 0) {
        const impact = -b.vy;
        b.vy = -b.vy * PHYS.ballBounce;
        if (impact > 2.5) this.emit('bounce', { x: b.x, strength: impact / 14 });
        if (Math.abs(b.vy) < 1.2) b.vy = 0;
      }
      // rolling friction
      const f = PHYS.ballRollFriction * dt;
      if (Math.abs(b.vx) <= f) b.vx = 0; else b.vx -= Math.sign(b.vx) * f;
    }
    // net roof (top of the goal) acts as a platform outside the goal mouth
    if (Math.abs(b.x) > FIELD.goalX && prevY - b.r >= FIELD.goalHeight - 0.02 && b.y - b.r < FIELD.goalHeight && b.vy < 0) {
      b.y = FIELD.goalHeight + b.r;
      b.vy = -b.vy * PHYS.ballBounce;
      if (Math.abs(b.vy) < 1.2) b.vy = 0;
      this.emit('bounce', { x: b.x, strength: 0.3 });
    }
    // the roof is slightly sloped: a ball sitting on it rolls back into play
    if (Math.abs(b.x) > FIELD.goalX && Math.abs(b.y - (FIELD.goalHeight + b.r)) < 0.05 && Math.abs(b.vy) < 1.5) {
      b.vx -= Math.sign(b.x) * 7 * dt;
    }
    // ceiling
    if (b.y + b.r > FIELD.ceiling) { b.y = FIELD.ceiling - b.r; b.vy = -Math.abs(b.vy) * PHYS.wallBounce; }
    // under-roof (ball inside the goal bouncing up)
    if (Math.abs(b.x) > FIELD.goalX + b.r * 0.5 && b.y + b.r > FIELD.goalHeight && prevY + b.r <= FIELD.goalHeight + 0.02 && b.vy > 0) {
      b.y = FIELD.goalHeight - b.r; b.vy = -b.vy * 0.5;
    }
    // walls
    const W = FIELD.halfWidth - b.r;
    if (b.x < -W) { b.x = -W; if (b.vx < 0) { b.vx = -b.vx * PHYS.wallBounce; this.emit('bounce', { x: b.x, strength: Math.abs(b.vx) / 14 }); } }
    if (b.x > W) { b.x = W; if (b.vx > 0) { b.vx = -b.vx * PHYS.wallBounce; this.emit('bounce', { x: b.x, strength: Math.abs(b.vx) / 14 }); } }

    // posts (crossbar end points)
    for (const sgn of [-1, 1]) {
      const px = sgn * FIELD.goalX, py = FIELD.goalHeight;
      const dx = b.x - px, dy = b.y - py;
      const d = Math.hypot(dx, dy);
      const minD = b.r + FIELD.postRadius;
      if (d < minD && d > 1e-6) {
        const nx = dx / d, ny = dy / d;
        b.x = px + nx * minD; b.y = py + ny * minD;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + PHYS.wallBounce) * vn * nx;
          b.vy -= (1 + PHYS.wallBounce) * vn * ny;
          this.emit('post', { x: b.x, strength: Math.min(1, -vn / 12) });
        }
      }
    }
    b.spin = b.vx / b.r;
    void prevX; void live;
  }

  collideCircle(p, cx, cy, cr, e, isHead) {
    const b = this.ball;
    const dx = b.x - cx, dy = b.y - cy;
    const d = Math.hypot(dx, dy);
    const minD = cr + b.r;
    if (d >= minD || d < 1e-6) return false;
    const nx = dx / d, ny = dy / d;
    b.x = cx + nx * minD;
    b.y = cy + ny * minD;
    // never push the ball into the ground: squeeze it out sideways instead
    if (b.y < b.r) {
      b.y = b.r;
      const dyc = b.y - cy;
      const need = Math.sqrt(Math.max(0, minD * minD - dyc * dyc));
      const side = dx !== 0 ? Math.sign(dx) : -p.facing;
      b.x = cx + side * need;
    }
    const rvx = b.vx - p.vx, rvy = b.vy - p.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const j = -(1 + e) * vn;
      b.vx += j * nx;
      b.vy += j * ny;
      // headers get an extra push from the jump
      if (isHead && p.vy > 1) b.vy += p.vy * 0.25;
      // friction/spin transfer
      const tx = -ny, ty = nx;
      const vt = rvx * tx + rvy * ty;
      b.vx -= vt * tx * 0.15; b.vy -= vt * ty * 0.15;
      this.clampBall();
      const strength = Math.min(1, -vn / 12);
      // only real impacts count as headers (a ball resting on the head touches every step)
      if (isHead && -vn > 2 && this.frame - p.lastHeadHit > 12) {
        p.lastHeadHit = this.frame;
        this.stats.headers[p.slot]++;
        this.emit('head', { slot: p.slot, strength, x: b.x, y: b.y });
      }
      return true;
    }
    return false;
  }

  clampBall() {
    const b = this.ball;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > PHYS.ballMaxSpeed) { b.vx *= PHYS.ballMaxSpeed / sp; b.vy *= PHYS.ballMaxSpeed / sp; }
    const W = FIELD.halfWidth - b.r;
    if (b.x < -W) b.x = -W;
    if (b.x > W) b.x = W;
    if (b.y < b.r) b.y = b.r;
    if (b.y > FIELD.ceiling - b.r) b.y = FIELD.ceiling - b.r;
  }

  collideBallPlayer(p) {
    this.collideCircle(p, p.x, p.y + p.headH, p.headR, p.headBounce, true);
    this.collideCircle(p, p.x, p.y + p.bodyH, p.bodyR, 0.55, false);
  }

  /** Foot position during a kick, for both the hit test and the renderer. */
  static footPose(p) {
    if (p.kickT < 0) return null;
    const s = clamp(p.kickT / PHYS.kickDuration, 0, 1);
    const arc = Math.sin(s * Math.PI);
    return {
      s,
      x: p.x + p.facing * (0.2 + 0.75 * arc),
      y: p.y + 0.08 + 0.7 * arc,
      r: 0.3,
    };
  }

  kickCheck(p) {
    if (p.kickT < 0 || p.kickHit) return;
    const s = p.kickT / PHYS.kickDuration;
    if (s < PHYS.kickWindow[0] || s > PHYS.kickWindow[1]) return;
    const f = Match.footPose(p);
    const b = this.ball;
    const dx = b.x - f.x, dy = b.y - f.y;
    if (Math.hypot(dx, dy) > f.r + b.r) return;
    // only hit balls that are in front of the player
    if ((b.x - p.x) * p.facing < -0.1) return;
    p.kickHit = true;
    const rel = clamp((b.y - (p.y + 0.3)) / 1.2, 0, 1); // 0 low ball, 1 high ball
    const angle = (40 - 22 * rel) * Math.PI / 180;
    const power = p.kickPower * (0.85 + 0.15 * Math.sin(Math.min(1, s / 0.5) * Math.PI / 2));
    b.vx = p.facing * power * Math.cos(angle) + p.vx * 0.3;
    b.vy = power * Math.sin(angle) + Math.max(0, p.vy) * 0.4;
    b.x = f.x + p.facing * 0.05;
    this.clampBall();
    this.emit('kick', { slot: p.slot, power: power / 20, x: f.x, y: f.y });
  }

  checkGoal() {
    const b = this.ball;
    if (b.y - b.r > FIELD.goalHeight) return;
    let scorer = -1;
    if (b.x + b.r < -FIELD.goalX) scorer = 1;        // ball inside left goal → player 2 scores
    else if (b.x - b.r > FIELD.goalX) scorer = 0;    // inside right goal → player 1 scores
    if (scorer < 0) return;
    this.score[scorer]++;
    this.lastScorer = scorer;
    this.phase = 'goal';
    this.phaseT = 0;
    this.emit('goal', { scorer, score: [...this.score], x: b.x, y: b.y });
  }
}
