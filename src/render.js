// Three.js scene management: stadium, avatars, ball, camera and effects.

import * as THREE from 'three';
import { buildStadium } from './stadium.js';
import { Avatar } from './avatar.js';
import { Confetti, Dust, Trail } from './effects.js';
import { PHYS } from './config.js';

function ballTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#151515';
  const pent = (x, y, r, rot = 0) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  };
  for (let i = 0; i < 6; i++) pent(i * 85 + 40, 70 + (i % 2) * 110, 30, i);
  pent(256, 128, 26, 0.3);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i * 85 + 40, 0); ctx.lineTo(i * 85 + 70, 256); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.camBase = new THREE.Vector3(0, 5.2, 19.5);
    this.camLook = new THREE.Vector3(0, 2.2, 0);
    this.camPos = this.camBase.clone();
    this.camTarget = this.camLook.clone();
    this.shake = 0;
    this.zoom = 1;

    this.stadium = buildStadium(this.scene);
    this.confetti = new Confetti(this.scene);
    this.dust = new Dust(this.scene);
    this.trail = new Trail(this.scene);

    const ballMat = new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45, metalness: 0.05, emissive: '#ff6a00', emissiveIntensity: 0 });
    this.ballMat = ballMat;
    this.glow = 0;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(PHYS.ballRadius, 32, 24), ballMat);
    this.ball.castShadow = true;
    this.scene.add(this.ball);

    this.avatars = [null, null];
    this.time = 0;
    this.menuOrbit = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the whole pitch (± ~10.5 units) in view on any aspect ratio
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const needed = 11.2 / Math.tan(hfov / 2);
    this.camBase.z = Math.max(19.5, needed);
    this.camBase.y = 5.2 + (this.camBase.z - 19.5) * 0.18;
    this.camera.updateProjectionMatrix();
  }

  setPlayers(rosters) {
    this.confetti.clear();
    this.dust.clear();
    this.trail.clear();
    this.shake = 0;
    for (let i = 0; i < 2; i++) {
      if (this.avatars[i]) { this.scene.remove(this.avatars[i].root); this.avatars[i].dispose(); }
      const av = new Avatar(rosters[i]);
      av.root.position.set(i === 0 ? -4 : 4, 0, 0);
      av.setFacing(i === 0 ? 1 : -1, true);
      this.scene.add(av.root);
      this.avatars[i] = av;
    }
  }

  /** Apply one simulation event to the visuals. */
  onEvent(ev) {
    switch (ev.type) {
      case 'goal':
        this.confetti.burst(ev.x, Math.max(1.5, ev.y + 1), 220, 1.2);
        this.confetti.burst(-ev.x * 0.5, 4, 80, 0.8);
        this.shake = 0.5;
        this.crowdWave = 3;
        break;
      case 'kick':
        this.dust.puff(ev.x, Math.max(0, ev.y - 0.4), 6, 0.8);
        this.shake = Math.max(this.shake, 0.08 * ev.power);
        break;
      case 'land':
        this.dust.puff(this.avatars[ev.slot].root.position.x, 0, 8, Math.min(1.4, ev.speed / 9));
        break;
      case 'head':
        if (ev.strength > 0.55) this.avatars[ev.slot].bonk();
        this.shake = Math.max(this.shake, 0.06 * ev.strength);
        break;
      case 'bounce':
        if (ev.strength > 0.4) this.dust.puff(ev.x, 0, 4, ev.strength);
        break;
      case 'end':
        if (ev.winner >= 0) this.confetti.burst(this.avatars[ev.winner].root.position.x, 3, 260, 1.4);
        break;
      case 'powershot':
        this.shake = 0.45;
        this.trail.emit(ev.x, ev.y, 0, 0, 30, 1.2);
        this.dust.puff(ev.x, Math.max(0, ev.y - 0.4), 10, 1.4);
        break;
      case 'knock':
        this.shake = Math.max(this.shake, 0.3);
        this.trail.emit(ev.x, ev.y, 0, 0, 16, 1);
        this.avatars[ev.slot].bonk();
        break;
    }
  }

  update(match, dt) {
    this.time += dt;
    const b = match.ball;
    this.ball.position.set(b.x, b.y, 0);
    this.ball.rotation.z -= (b.vx / b.r) * dt;
    this.ball.rotation.x += (b.vy * 0.2 / b.r) * dt;

    for (let i = 0; i < 2; i++) {
      const av = this.avatars[i];
      if (av) av.update(match.players[i], dt, this.time);
    }
    this.confetti.update(dt);
    this.dust.update(dt);
    // fire trail on fast balls / power shots
    const speed = Math.hypot(b.vx, b.vy);
    const heat = b.fire ? 1 : THREE.MathUtils.clamp((speed - PHYS.fireSpeed) / 8, 0, 0.8);
    if (heat > 0 && match.phase !== 'countdown') this.trail.emit(b.x, b.y, b.vx, b.vy, b.fire ? 5 : 2, heat);
    this.trail.update(dt);
    this.glow += ((b.fire ? 1.6 : heat * 0.8) - this.glow) * Math.min(1, dt * 8);
    this.ballMat.emissiveIntensity = this.glow;

    // crowd wobble after a goal
    if (this.crowdWave > 0) {
      this.crowdWave -= dt;
      this.stadium.crowdMat.map.offset.y = Math.sin(this.time * 18) * 0.012 * Math.min(1, this.crowdWave);
    } else {
      this.stadium.crowdMat.map.offset.y = Math.sin(this.time * 1.5) * 0.002;
    }

    // camera: gentle follow of the ball, orbit on menus
    let tx, ty, tz, lx, ly;
    if (this.menuOrbit) {
      const a = this.time * 0.12;
      tx = Math.sin(a) * 9; tz = 15 + Math.cos(a) * 5; ty = 4.5 + Math.sin(a * 0.7) * 1.2;
      lx = 0; ly = 1.8;
    } else {
      const px = (match.players[0].x + match.players[1].x) / 2;
      const focusX = b.x * 0.6 + px * 0.4;
      tx = THREE.MathUtils.clamp(focusX * 0.22, -2.2, 2.2);
      ty = this.camBase.y + THREE.MathUtils.clamp(b.y * 0.06, 0, 0.5);
      tz = this.camBase.z * this.zoom;
      lx = THREE.MathUtils.clamp(focusX * 0.3, -2.5, 2.5);
      ly = 2.1 + THREE.MathUtils.clamp(b.y * 0.08, 0, 0.5);
    }
    const k = 1 - Math.exp(-dt * (this.menuOrbit ? 1.5 : 4));
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camTarget.x += (lx - this.camTarget.x) * k;
    this.camTarget.y += (ly - this.camTarget.y) * k;
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.camTarget);
    this.renderer.render(this.scene, this.camera);
  }
}

/** Small rotating avatar preview for the character select screen. */
export class PreviewRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 1.2, 4.6);
    this.camera.lookAt(0, 0.95, 0);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#445', 1.2));
    const key = new THREE.DirectionalLight('#ffffff', 2.0);
    key.position.set(2, 4, 3);
    this.scene.add(key);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.7, 40), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25 }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.005;
    this.scene.add(disc);
    this.avatar = null;
    this.t = 0;
    this.expr = 'happy';
    this.exprT = 0;
    this.fakeState = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, onGround: true, kickT: -1 };
  }

  setPlayer(p) {
    if (this.avatar) { this.scene.remove(this.avatar.root); this.avatar.dispose(); }
    this.avatar = new Avatar(p);
    this.avatar.setFacing(1, true);
    this.scene.add(this.avatar.root);
    this.avatar.setExpression('happy');
    this.avatar.setCelebrate('win');
    this.exprT = 0;
  }

  render(dt) {
    if (!this.avatar) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (this.canvas.width !== Math.floor(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.t += dt;
    this.exprT += dt;
    const cycle = ['happy', 'focus', 'smug', 'shock', 'neutral'];
    this.avatar.setExpression(cycle[Math.floor(this.exprT / 1.4) % cycle.length]);
    this.fakeState.y = Math.abs(Math.sin(this.t * 4)) * 0.12;
    this.avatar.update(this.fakeState, dt, this.t);
    this.avatar.root.rotation.y = Math.sin(this.t * 0.8) * 0.5;
    this.renderer.render(this.scene, this.camera);
  }
}
