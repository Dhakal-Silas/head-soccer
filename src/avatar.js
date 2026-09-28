// 3D player avatar: big head with a canvas face, hair styles, small body,
// swinging arms/legs and mood-driven animation.

import * as THREE from 'three';
import { faceTexture } from './faces.js';
import { Match } from './physics.js';
import { PHYS, statMap } from './config.js';

const HEAD_YAW = THREE.MathUtils.degToRad(38); // turn the face toward the camera

function jerseyTexture(p) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d');
  const c = p.colors;
  ctx.fillStyle = c.jersey;
  ctx.fillRect(0, 0, 512, 256);
  if (c.pattern === 'checkers') {
    ctx.fillStyle = c.accent;
    const s = 32;
    for (let y = 0; y < 256; y += s) for (let x = 0; x < 512; x += s) if (((x + y) / s) % 2 === 0) ctx.fillRect(x, y, s, s);
  } else if (p.id === 'messi') {
    ctx.fillStyle = c.accent;
    for (let x = 0; x < 512; x += 128) ctx.fillRect(x, 0, 64, 256);
  } else if (p.id === 'ronaldinho') {
    ctx.fillStyle = c.accent;
    for (let x = 32; x < 512; x += 128) ctx.fillRect(x, 0, 64, 256);
  } else {
    // sleeve / side stripes
    ctx.fillStyle = c.accent;
    ctx.fillRect(0, 0, 512, 14);
    ctx.fillRect(112, 0, 10, 256);
    ctx.fillRect(390, 0, 10, 256);
  }
  // number on the front (u = 0.5 after the mesh is rotated by PI)
  ctx.font = 'bold 150px "Bebas Neue", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeText(String(p.number), 256, 140);
  ctx.fillStyle = luminance(c.jersey) > 0.5 ? '#111' : '#fff';
  ctx.fillText(String(p.number), 256, 140);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.0, ...opts });
}

function buildHair(p, R) {
  const g = new THREE.Group();
  const m = mat(p.colors.hair, { roughness: 0.9 });
  const cap = (r, thetaLen, y = 0, x = 0) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18, 0, Math.PI * 2, 0, thetaLen), m);
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    return mesh;
  };
  // back shell: -x hemisphere in local space (the face is at +x)
  const back = (r, thetaLen) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18, -Math.PI / 2, Math.PI, 0, thetaLen), m);
    mesh.castShadow = true;
    return mesh;
  };
  // Every style = a top cap (front hairline ~35° above the eyes) + a back
  // shell that reaches further down behind the ears, so the face stays clear.
  switch (p.hair) {
    case 'buzz':
      g.add(cap(R * 1.03, Math.PI * 0.3, 0, -R * 0.03));
      g.add(back(R * 1.03, Math.PI * 0.5));
      break;
    case 'short':
      g.add(cap(R * 1.05, Math.PI * 0.33, 0, -R * 0.04));
      g.add(back(R * 1.05, Math.PI * 0.55));
      break;
    case 'quiff': {
      g.add(cap(R * 1.05, Math.PI * 0.33, 0, -R * 0.04));
      g.add(back(R * 1.05, Math.PI * 0.55));
      const q = new THREE.Mesh(new THREE.SphereGeometry(R * 0.3, 16, 12), m);
      q.scale.set(1.5, 0.7, 1.1);
      q.position.set(R * 0.42, R * 0.95, 0);
      q.rotation.z = 0.5;
      g.add(q);
      break;
    }
    case 'long':
      g.add(cap(R * 1.06, Math.PI * 0.34, 0, -R * 0.03));
      g.add(back(R * 1.07, Math.PI * 0.8));
      break;
    case 'headband': {
      g.add(cap(R * 1.07, Math.PI * 0.35, 0, -R * 0.03));
      g.add(back(R * 1.08, Math.PI * 0.82));
      const band = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, R * 0.07, 10, 40), mat('#f4f4f4'));
      band.rotation.x = Math.PI / 2;
      band.rotation.y = 0.2;
      band.position.y = R * 0.5;
      g.add(band);
      break;
    }
    case 'curly': {
      g.add(cap(R * 1.1, Math.PI * 0.36, 0, -R * 0.03));
      g.add(back(R * 1.1, Math.PI * 0.62));
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 10, 8), m);
        // ring of curls around the crown, kept away from the face (+x)
        const ring = 0.6;
        const px = Math.cos(a) * R * ring, pz = Math.sin(a) * R * ring;
        if (px > R * 0.35) continue;
        b.position.set(px, R * 0.92, pz);
        g.add(b);
      }
      const top = new THREE.Mesh(new THREE.SphereGeometry(R * 0.32, 12, 10), m);
      top.position.set(-R * 0.1, R * 1.05, 0);
      g.add(top);
      break;
    }
    case 'mohawk': {
      g.add(cap(R * 1.03, Math.PI * 0.28, 0, -R * 0.04));
      g.add(back(R * 1.03, Math.PI * 0.45));
      const strip = new THREE.Mesh(new THREE.SphereGeometry(R * 0.45, 16, 12), m);
      strip.scale.set(1.6, 0.9, 0.35);
      strip.position.set(-R * 0.05, R * 0.98, 0);
      g.add(strip);
      break;
    }
    case 'bun': {
      g.add(cap(R * 1.05, Math.PI * 0.34, 0, -R * 0.03));
      g.add(back(R * 1.06, Math.PI * 0.62));
      const bun = new THREE.Mesh(new THREE.SphereGeometry(R * 0.3, 14, 10), m);
      bun.position.set(-R * 0.55, R * 0.95, 0);
      g.add(bun);
      break;
    }
    default:
      g.add(cap(R * 1.05, Math.PI * 0.33));
      g.add(back(R * 1.05, Math.PI * 0.55));
  }
  return g;
}

export class Avatar {
  constructor(p) {
    this.p = p;
    const R = statMap.headRadius(p.stats.size);
    this.R = R;
    this.headH = 0.72 + R;
    this.root = new THREE.Group();
    this.expression = 'neutral';
    this.runPhase = 0;
    this.squash = 1;
    this.squashV = 0;
    this.wasGround = true;
    this.celebrate = 'none'; // none | win | lose
    this.celebT = 0;
    this.shake = 0;
    this.faceMats = new Map();

    const c = p.colors;
    // ---- legs (pivot at the hip)
    const legLen = 0.3;
    this.legs = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.36, side * 0.1);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, legLen - 0.12, 4, 10), mat(c.socks));
      leg.position.y = -legLen / 2 + 0.02;
      leg.castShadow = true;
      const skin = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.1, 10), mat(c.skin));
      skin.position.y = -0.1;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.13), mat('#1b1b1b', { roughness: 0.5 }));
      shoe.position.set(0.04, -legLen + 0.01, 0);
      shoe.castShadow = true;
      pivot.add(leg, skin, shoe);
      this.root.add(pivot);
      this.legs.push(pivot);
    }
    // ---- shorts
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 16), mat(c.shorts));
    shorts.position.y = 0.4;
    shorts.castShadow = true;
    this.root.add(shorts);
    // ---- torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.26, 6, 20), new THREE.MeshStandardMaterial({ map: jerseyTexture(p), roughness: 0.8 }));
    torso.position.y = 0.66;
    torso.rotation.y = Math.PI; // number faces +z (camera)
    torso.castShadow = true;
    this.root.add(torso);
    this.torso = torso;
    // ---- arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.84, side * 0.26);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.16, 4, 10), mat(c.jersey));
      arm.position.y = -0.1;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), mat(c.skin));
      hand.position.y = -0.24;
      pivot.add(arm, hand);
      pivot.rotation.x = side * 0.25;
      this.root.add(pivot);
      this.arms.push(pivot);
    }
    // ---- head (neck group for nods/tilts, head group for yaw)
    this.neck = new THREE.Group();
    this.neck.position.y = this.headH;
    this.head = new THREE.Group();
    this.neck.add(this.head);
    this.root.add(this.neck);
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), this.faceMaterial('neutral'));
    this.headMesh.castShadow = true;
    this.head.add(this.headMesh);
    this.head.add(buildHair(p, R));
    this.setFacing(1, true);
  }

  faceMaterial(expr) {
    if (!this.faceMats.has(expr)) {
      this.faceMats.set(expr, new THREE.MeshStandardMaterial({ map: faceTexture(this.p, expr), roughness: 0.7 }));
    }
    return this.faceMats.get(expr);
  }

  setExpression(expr) {
    if (expr === this.expression) return;
    this.expression = expr;
    this.headMesh.material = this.faceMaterial(expr);
  }

  setFacing(f, snap = false) {
    // local +x (the face) should point to (f·cos yaw, 0, sin yaw)
    const target = f === 1 ? -HEAD_YAW : -(Math.PI - HEAD_YAW);
    this.targetYaw = target;
    if (snap) this.head.rotation.y = target;
  }

  /** Called every render frame with the simulation state for this player. */
  update(state, dt, time) {
    const r = this.root;
    r.position.set(state.x, state.y, 0);
    const f = state.facing;
    this.setFacing(f);
    // smooth yaw (shortest path)
    let dy = this.targetYaw - this.head.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.head.rotation.y += dy * Math.min(1, dt * 12);

    // landing squash
    if (!this.wasGround && state.onGround) { this.squashV = -6; }
    this.wasGround = state.onGround;
    const k = 120, d = 12;
    this.squashV += (-(this.squash - 1) * k - this.squashV * d) * dt;
    this.squash += this.squashV * dt;
    const sq = this.squash;
    r.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));

    const speed = Math.abs(state.vx);
    const running = state.onGround && speed > 0.6;
    if (running) this.runPhase += dt * (6 + speed * 1.6);
    const swing = running ? Math.sin(this.runPhase) * Math.min(0.9, 0.3 + speed * 0.09) : 0;
    const airPose = !state.onGround ? (state.vy > 0 ? 0.6 : 0.25) : 0;

    // legs
    const foot = Match.footPose(state);
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      const sgn = i === 0 ? 1 : -1;
      let rz = swing * sgn * Math.sign(state.vx || 1) * -1;
      let rx = 0;
      if (!state.onGround) { rz = sgn * 0.15; rx = sgn * airPose * 0.5; }
      if (foot && i === 1) {
        // kicking leg: wind up then snap forward
        const s = foot.s;
        const curve = s < 0.25 ? -0.9 * (s / 0.25) : 2.1 * Math.sin(((s - 0.25) / 0.75) * Math.PI);
        rz = f * curve;
      }
      leg.rotation.z += (rz - leg.rotation.z) * Math.min(1, dt * 25);
      leg.rotation.x += (rx - leg.rotation.x) * Math.min(1, dt * 12);
    }
    // arms
    for (let i = 0; i < 2; i++) {
      const arm = this.arms[i];
      const sgn = i === 0 ? -1 : 1;
      let rz = swing * sgn * Math.sign(state.vx || 1) * 0.8;
      let rx = sgn * 0.25;
      if (!state.onGround) { rz = -f * 0.4; rx = sgn * 1.2; }
      if (foot) { rz = -f * (0.4 + 0.6 * Math.sin(foot.s * Math.PI)) * (i === 1 ? 1 : -0.4); }
      if (this.celebrate === 'win') {
        const t = this.celebT;
        rx = sgn * (2.6 + Math.sin(t * 8 + i) * 0.35);
        rz = Math.sin(t * 8) * 0.3;
      } else if (this.celebrate === 'lose') {
        rx = sgn * 0.1; rz = 0;
      }
      arm.rotation.z += (rz - arm.rotation.z) * Math.min(1, dt * 14);
      arm.rotation.x += (rx - arm.rotation.x) * Math.min(1, dt * 10);
    }

    // head lean / nod / bob
    let lean = -state.vx * 0.02;
    let nod = 0;
    let bob = running ? Math.abs(Math.sin(this.runPhase)) * 0.03 : 0;
    if (this.celebrate === 'win') {
      this.celebT += dt;
      nod = Math.sin(this.celebT * 8) * 0.12;
      bob = Math.abs(Math.sin(this.celebT * 4)) * 0.05;
    } else if (this.celebrate === 'lose') {
      this.celebT += dt;
      nod = 0.45 + Math.sin(this.celebT * 12) * 0.02;
      lean = Math.sin(this.celebT * 3) * 0.05;
    }
    if (this.shake > 0) {
      this.shake -= dt;
      lean += Math.sin(time * 60) * 0.12 * Math.min(1, this.shake / 0.4);
    }
    this.neck.rotation.z += (lean - this.neck.rotation.z) * Math.min(1, dt * 10);
    this.neck.rotation.x += (nod * (f === 1 ? 1 : 1) - this.neck.rotation.x) * Math.min(1, dt * 8);
    this.neck.position.y = this.headH + bob;
    // when sad, the whole body slumps
    const slump = this.celebrate === 'lose' ? 0.93 : 1;
    this.torso.scale.y += (slump - this.torso.scale.y) * Math.min(1, dt * 4);
  }

  setCelebrate(mode) {
    if (this.celebrate !== mode) { this.celebrate = mode; this.celebT = 0; }
  }

  /** Small head jiggle after a hard header. */
  bonk() { this.shake = 0.4; }

  dispose() {
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}

export { PHYS };
