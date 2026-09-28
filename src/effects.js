// Confetti burst + dust puffs using a single InstancedMesh each.

import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export class Confetti {
  constructor(scene, count = 320) {
    this.count = count;
    const geo = new THREE.PlaneGeometry(0.16, 0.1);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.particles = new Array(count).fill(null).map(() => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, life: 0 }));
    this.colors = ['#ff3d7f', '#c6ff3d', '#3dd6ff', '#ffd23d', '#ffffff', '#b45cff'];
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      color.set(this.colors[i % this.colors.length]);
      this.mesh.setColorAt(i, color);
      _m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
    this.next = 0;
  }

  clear() {
    for (let i = 0; i < this.count; i++) { this.particles[i].alive = false; _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  burst(x, y, n = 160, spread = 1) {
    for (let k = 0; k < n; k++) {
      const p = this.particles[this.next];
      this.next = (this.next + 1) % this.count;
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 0.4;
      p.y = y + (Math.random() - 0.5) * 0.4;
      p.z = (Math.random() - 0.5) * 0.4;
      const a = Math.random() * Math.PI * 2;
      const sp = (3 + Math.random() * 7) * spread;
      p.vx = Math.cos(a) * sp;
      p.vy = 5 + Math.random() * 8;
      p.vz = Math.sin(a) * sp * 0.6;
      p.rx = Math.random() * 6; p.ry = Math.random() * 6; p.rz = Math.random() * 6;
      p.wx = (Math.random() - 0.5) * 12; p.wy = (Math.random() - 0.5) * 12; p.wz = (Math.random() - 0.5) * 12;
      p.life = 2.6 + Math.random() * 1.2;
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      any = true;
      p.life -= dt;
      if (p.life <= 0 || p.y < -1) {
        p.alive = false;
        _m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m);
        continue;
      }
      p.vy -= 9 * dt;
      const drag = 1 - 1.6 * dt;
      p.vx *= drag; p.vz *= drag; p.vy *= 1 - 0.8 * dt;
      // flutter
      p.vx += Math.sin(p.ry * 3 + p.life * 5) * 2 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
      const s = Math.min(1, p.life / 0.5);
      _e.set(p.rx, p.ry, p.rz);
      _q.setFromEuler(_e);
      _p.set(p.x, p.y, p.z);
      _s.set(s, s, s);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
    this.active = any;
  }
}

export class Dust {
  constructor(scene, count = 60) {
    this.count = count;
    const geo = new THREE.SphereGeometry(0.12, 6, 5);
    const mat = new THREE.MeshBasicMaterial({ color: '#e8f0d8', transparent: true, opacity: 0.55, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.parts = new Array(count).fill(null).map(() => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1 }));
    for (let i = 0; i < count; i++) { _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); }
    scene.add(this.mesh);
    this.next = 0;
  }

  clear() {
    for (let i = 0; i < this.count; i++) { this.parts[i].alive = false; _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  puff(x, y, n = 8, power = 1) {
    for (let k = 0; k < n; k++) {
      const p = this.parts[this.next];
      this.next = (this.next + 1) % this.count;
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 0.3; p.y = y + 0.05; p.z = (Math.random() - 0.5) * 0.4;
      const a = Math.random() * Math.PI * 2;
      p.vx = Math.cos(a) * 1.5 * power; p.vz = Math.sin(a) * 1.0 * power; p.vy = 0.8 + Math.random() * 1.2 * power;
      p.max = p.life = 0.35 + Math.random() * 0.3;
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.count; i++) {
      const p = this.parts[i];
      if (!p.alive) continue;
      any = true;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy -= 1.5 * dt;
      const t = 1 - p.life / p.max;
      const s = 0.6 + t * 1.6;
      _p.set(p.x, p.y, p.z); _q.identity(); _s.set(s, s, s);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
