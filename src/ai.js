// CPU opponent. Five difficulty levels change reaction time, prediction
// noise, movement speed and how often it commits to jumps and kicks.

import { DIFFICULTIES, FIELD } from './config.js';
import { predictBall, predictCross } from './physics.js';

const rand = (a, b) => a + Math.random() * (b - a);
const gauss = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export class CpuBrain {
  constructor(level, slot) {
    this.cfg = DIFFICULTIES[Math.max(1, Math.min(5, level)) - 1];
    this.slot = slot;
    this.reactT = 0;
    this.targetX = slot === 0 ? -4 : 4;
    this.noiseX = 0;
    this.kickCooldown = 0;
    this.jumpCooldown = 0;
    this.idleT = 0;
    this.wantJump = false;
    this.wantKick = false;
    this.mode = 'defend';
    this.blockT = Infinity;
    this.blockY = 0;
  }

  decide(match, dt) {
    const me = match.players[this.slot];
    const foe = match.players[1 - this.slot];
    const ball = match.ball;
    const cfg = this.cfg;
    const cmd = { left: false, right: false, jump: false, kickLow: false, kickHigh: false, power: false, speedScale: cfg.speed };
    if (match.phase !== 'play') return cmd;

    this.kickCooldown -= dt;
    this.jumpCooldown -= dt;
    this.reactT -= dt;
    this.idleT -= dt;
    this.blockT -= dt;

    const ownGoalX = this.slot === 0 ? -FIELD.goalX : FIELD.goalX;
    const dir = this.slot === 0 ? 1 : -1;          // direction of attack
    const headY = me.y + me.headH;
    const lineX = ownGoalX + dir * 1.1;             // where we stand to block shots

    if (this.reactT <= 0) {
      this.reactT = cfg.reaction * rand(0.7, 1.3);
      this.noiseX = gauss() * cfg.noise;
      if (cfg.idle > 0 && Math.random() < cfg.idle * 0.25) this.idleT = rand(0.2, 0.6);

      const towardMe = (ball.vx * dir) < 0 || Math.abs(ball.vx) < 0.5;
      const ballOnMySide = (ball.x * dir) < 0;
      const pred = predictBall(ball, headY + 0.2, 1.8);
      const predX = pred.x + this.noiseX;

      // 1) shot coming at our goal → get on the line and block
      let block = null;
      if (ball.vx * dir < -3.0 && (ball.x - lineX) * dir > 0.2) block = predictCross(ball, lineX, 2.2);
      if (block && block.y < 4.4) {
        this.mode = 'block';
        this.targetX = lineX + dir * 0.1 + this.noiseX * 0.4;
        this.blockT = block.t;
        this.blockY = block.y;
      } else if ((ball.x - me.x) * dir < -0.4 && ball.y < 2.5) {
        // 2) ball got behind us → rush back around it
        this.mode = 'recover';
        this.targetX = ball.x - dir * 0.8;
      } else if (ballOnMySide || (towardMe && (predX * dir) < 1.5) || Math.abs(ball.x - me.x) < 2.5) {
        // 3) go for the ball, standing slightly behind it so a kick goes forward
        this.mode = 'attack';
        const behind = 0.35 + 0.15 * (5 - cfg.level);
        this.targetX = predX - dir * behind;
      } else {
        // 4) hold a position between our goal and the ball
        this.mode = 'defend';
        const depth = 1.2 + Math.abs(ball.x - ownGoalX) * 0.08;
        this.targetX = ownGoalX + dir * depth + this.noiseX * 0.5;
      }

      // decide on jump/kick intentions for this reaction window
      const dx = (ball.x - me.x) * me.facing;
      const dy = ball.y - headY;
      const near = Math.abs(ball.x - me.x) < 1.6;
      this.wantJump = near && dy > 0.35 && dy < 3.2 && Math.random() < cfg.jumpP;
      this.wantKick = dx > -0.1 && dx < 1.4 && Math.abs(ball.y - (me.y + 0.6)) < 1.1 && Math.random() < cfg.kickP;
      if (near && dy > 0.2 && Math.random() < cfg.jumpP * 0.5) this.wantJump = true;
    }

    if (this.idleT > 0) return cmd;

    // steer towards targetX
    const clampedTarget = Math.max(-FIELD.halfWidth + 0.6, Math.min(FIELD.halfWidth - 0.6, this.targetX));
    const diff = clampedTarget - me.x;
    const dead = 0.12;
    if (diff > dead) cmd.right = true;
    else if (diff < -dead) cmd.left = true;
    if (Math.abs(diff) < 0.6) cmd.speedScale = cfg.speed * 0.6;

    // hop over the opponent when they block the way
    const dxFoe = foe.x - me.x;
    if (Math.abs(dxFoe) < 0.9 && Math.abs(foe.y - me.y) < 0.5 && Math.sign(diff) === Math.sign(dxFoe) && Math.random() < 0.02) {
      cmd.jump = true;
    }

    const dxBall = (ball.x - me.x) * me.facing;   // positive = in front of the foot
    const dyBall = ball.y - headY;

    // blocking jump: leave the ground so the head meets the ball on the line
    if (this.mode === 'block' && me.onGround && this.jumpCooldown <= 0 && Math.abs(me.x - lineX) < 0.9) {
      const needJump = this.blockY > headY + 0.15;
      const rise = Math.max(0, this.blockY - headY);
      const tUp = Math.min(0.45, 0.12 + rise * 0.14);
      if (needJump && this.blockT <= tUp && this.blockT > -0.05 && Math.random() < cfg.jumpP + 0.1) {
        cmd.jump = true;
        this.jumpCooldown = 0.5;
      }
    }

    // jump
    if (this.wantJump && me.onGround && this.jumpCooldown <= 0 && Math.abs(ball.x - me.x) < 1.5 && dyBall > 0.2) {
      const pred = predictBall(ball, headY + 0.4, 0.6);
      if (pred.t < 0.45 || dyBall < 1.2) {
        cmd.jump = true;
        this.jumpCooldown = 0.45;
        this.wantJump = false;
      }
    }

    // kick: only when the kick would travel away from our own goal,
    // unless the ball is far enough from it to be safe
    const safeToKick = me.facing === dir || Math.abs(ball.x - ownGoalX) > 3.5;
    const foeAhead = (foe.x - me.x) * dir;
    const goalDist = Math.abs(dir * FIELD.goalX - me.x);
    // lob when the opponent stands in the way, drive it low otherwise
    const chooseKick = () => {
      if (me.power >= 1 && me.facing === dir && goalDist < 8.5 && Math.random() < cfg.powerP) {
        cmd.kickLow = true; cmd.power = true; return;
      }
      const lob = (foeAhead > 0.6 && foeAhead < 3.2 && foe.onGround) || goalDist > 7;
      if (lob) cmd.kickHigh = true; else cmd.kickLow = true;
    };
    if (this.wantKick && this.kickCooldown <= 0 && safeToKick) {
      const inFront = dxBall > -0.05 && dxBall < 1.25;
      const heightOk = ball.y > me.y - 0.1 && ball.y < me.y + 1.5;
      if (inFront && heightOk) {
        chooseKick();
        this.kickCooldown = 0.35 + (5 - cfg.level) * 0.08;
        this.wantKick = false;
      }
    }
    // emergency clearance right in front of our goal (facing away from it)
    if (!cmd.kickLow && !cmd.kickHigh && this.kickCooldown <= 0 && me.facing === dir && Math.abs(me.x - ownGoalX) < 2.4 && dxBall > -0.1 && dxBall < 1.2 && ball.y < me.y + 1.4 && Math.random() < cfg.kickP) {
      cmd.kickHigh = true;
      this.kickCooldown = 0.3;
    }

    return cmd;
  }
}
