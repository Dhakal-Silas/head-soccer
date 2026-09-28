// Builds the static stadium: pitch, goals with nets, stands with a crowd,
// ad boards, floodlights and the sky.

import * as THREE from 'three';
import { FIELD } from './config.js';

function canvasTexture(w, h, draw, opts = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  Object.assign(tex, opts);
  return tex;
}

export function skyTexture() {
  return canvasTexture(64, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b1a3a');
    g.addColorStop(0.45, '#1d4f9c');
    g.addColorStop(0.75, '#7fb5e6');
    g.addColorStop(1, '#dbeeff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function pitchTexture() {
  return canvasTexture(2048, 1024, (ctx, w, h) => {
    const stripes = 12;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#2f8f3c' : '#37a046';
      ctx.fillRect((i * w) / stripes, 0, w / stripes + 1, h);
    }
    // grain
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 8;
    const m = 60; // margin
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
    ctx.beginPath(); ctx.moveTo(w / 2, m); ctx.lineTo(w / 2, h - m); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 150, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 10, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill();
    // boxes
    for (const side of [0, 1]) {
      const x0 = side ? w - m : m;
      const dir = side ? -1 : 1;
      ctx.strokeRect(Math.min(x0, x0 + dir * 300), h / 2 - 300, 300, 600);
      ctx.strokeRect(Math.min(x0, x0 + dir * 110), h / 2 - 150, 110, 300);
      ctx.beginPath(); ctx.arc(x0 + dir * 300, h / 2, 90, side ? Math.PI * 0.5 : -Math.PI * 0.5, side ? Math.PI * 1.5 : Math.PI * 0.5); ctx.stroke();
    }
  }, { anisotropy: 8 });
}

function crowdTexture(seed = 1) {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, w, h);
    const palette = ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#ffb703', '#fb8500', '#8ecae6', '#d62828', '#2a9d8f', '#e9c46a', '#ffffff', '#222'];
    const skins = ['#f0c8a8', '#dba784', '#b07850', '#8d5a3b', '#6f4326'];
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const rows = 6, cols = 110;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5 + (r % 2) * 0.5) * (w / cols) + (rnd() - 0.5) * 4;
        const y = (r + 0.7) * (h / rows) + (rnd() - 0.5) * 6;
        ctx.fillStyle = palette[(rnd() * palette.length) | 0];
        ctx.fillRect(x - 4, y - 6, 8, 12);
        ctx.fillStyle = skins[(rnd() * skins.length) | 0];
        ctx.beginPath(); ctx.arc(x, y - 10, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }, { wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping });
}

function netTexture() {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= w; i += 16) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }
  }, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  return tex;
}

function adTexture(text) {
  return canvasTexture(2048, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#c6ff3d'); g.addColorStop(0.5, '#1c4fb0'); g.addColorStop(1, '#ff3d7f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < w; x += 512) ctx.fillRect(x + 2, 0, 4, h);
    ctx.font = 'bold 54px "Bebas Neue", Impact, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const items = text.split('|');
    items.forEach((t, i) => {
      const cx = (i + 0.5) * (w / items.length);
      ctx.fillText(t.trim(), cx, h / 2 + 4, w / items.length - 80);
    });
  }, { wrapS: THREE.RepeatWrapping });
}

export function buildStadium(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- ground and pitch
  const groundMat = new THREE.MeshStandardMaterial({ color: '#2a7a34', roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.halfWidth * 2 + 6, 13), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  group.add(pitch);

  // ---- goals
  const postMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.1 });
  const netMat = new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9 });
  const H = FIELD.goalHeight, D = FIELD.goalDepth, R = FIELD.postRadius;
  const backDepth = FIELD.halfWidth - FIELD.goalX;
  for (const sgn of [-1, 1]) {
    const g = new THREE.Group();
    const post = (x, z, h) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, h, 12), postMat);
      m.position.set(x, h / 2, z);
      m.castShadow = true;
      g.add(m);
    };
    // box frame: front posts + crossbar, thinner back frame, straight side bars
    post(0, D, H + R); post(0, -D, H + R);
    post(sgn * backDepth, D, H); post(sgn * backDepth, -D, H);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(R, R, D * 2 + R * 2, 12), postMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, H, 0);
    bar.castShadow = true;
    g.add(bar);
    const backBar = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.7, R * 0.7, D * 2 + R * 2, 8), postMat);
    backBar.rotation.x = Math.PI / 2;
    backBar.position.set(sgn * backDepth, H, 0);
    g.add(backBar);
    for (const z of [-D, D]) {
      const sb = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.7, R * 0.7, backDepth, 8), postMat);
      sb.position.set(sgn * backDepth / 2, H, z);
      sb.rotation.z = Math.PI / 2;
      g.add(sb);
    }
    const netPlane = (w, h, repX, repY) => {
      const m = netMat.clone();
      m.map = netMat.map.clone();
      m.map.repeat.set(repX, repY);
      m.map.needsUpdate = true;
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    };
    const back = netPlane(D * 2, H, 6, 4);
    back.position.set(sgn * backDepth, H / 2, 0);
    back.rotation.y = Math.PI / 2;
    g.add(back);
    const top = netPlane(backDepth, D * 2, 3, 6);
    top.position.set(sgn * backDepth / 2, H, 0);
    top.rotation.x = -Math.PI / 2;
    g.add(top);
    for (const z of [-D, D]) {
      const side = netPlane(backDepth, H, 3, 5);
      side.position.set(sgn * backDepth / 2, H / 2, z);
      g.add(side);
    }
    g.position.set(sgn * FIELD.goalX, 0, 0);
    group.add(g);
  }

  // ---- ad boards behind the pitch
  const adMat = new THREE.MeshStandardMaterial({ map: adTexture('HEAD SOCCER 3D | GOAL! | BIG HEADS | PLAY HARD'), roughness: 0.6, emissive: '#222', emissiveIntensity: 0.4 });
  adMat.map.repeat.set(2, 1);
  const ad = new THREE.Mesh(new THREE.BoxGeometry(34, 0.9, 0.25), [null, null, null, null, adMat, null].map((m) => m || new THREE.MeshStandardMaterial({ color: '#111' })));
  ad.position.set(0, 0.45, -7);
  ad.castShadow = true;
  group.add(ad);
  const adSide = adMat.clone();
  for (const sgn of [-1, 1]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 12), [adSide, adSide, null, null, null, null].map((m) => m || new THREE.MeshStandardMaterial({ color: '#111' })));
    box.position.set(sgn * 13, 0.45, -1);
    group.add(box);
  }

  // ---- stands (three tiers, back + two ends)
  const crowdMat = new THREE.MeshStandardMaterial({ map: crowdTexture(7), roughness: 1 });
  crowdMat.map.repeat.set(4, 1);
  const concrete = new THREE.MeshStandardMaterial({ color: '#4d5566', roughness: 1 });
  const buildStand = (length, tiers = 4) => {
    const s = new THREE.Group();
    for (let i = 0; i < tiers; i++) {
      const depth = 3.2, height = 2.4;
      const mats = [concrete, concrete, concrete, concrete, crowdMat, concrete];
      const tier = new THREE.Mesh(new THREE.BoxGeometry(length, height, depth), mats);
      tier.position.set(0, height / 2 + i * height * 0.9, -i * depth);
      s.add(tier);
    }
    // roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(length + 2, 0.4, tiers * 3.2 + 2), new THREE.MeshStandardMaterial({ color: '#c8ccd6', roughness: 0.6, metalness: 0.3 }));
    roof.position.set(0, tiers * 2.4 * 0.9 + 4.5, -(tiers - 1) * 1.6 - 0.5);
    s.add(roof);
    return s;
  };
  const backStand = buildStand(60);
  backStand.position.set(0, 0, -9);
  group.add(backStand);
  for (const sgn of [-1, 1]) {
    const end = buildStand(30, 3);
    end.rotation.y = sgn * Math.PI / 2;
    end.position.set(sgn * 20, 0, -1);
    group.add(end);
  }

  // ---- floodlights
  for (const [x, z] of [[-22, 8], [22, 8], [-22, -20], [22, -20]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 22, 8), concrete);
    pole.position.set(x, 11, z);
    group.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6d0', emissiveIntensity: 1.6 }));
    lamp.position.set(x * 0.95, 22, z * 0.9);
    lamp.lookAt(0, 0, 0);
    group.add(lamp);
  }

  // ---- lights
  const hemi = new THREE.HemisphereLight('#cfe6ff', '#2a5a2a', 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  sun.position.set(10, 18, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#9fc4ff', 0.5);
  fill.position.set(-10, 8, 6);
  scene.add(fill);

  scene.background = skyTexture();
  scene.fog = new THREE.Fog('#7fb5e6', 45, 110);

  return { group, crowdMat, sun };
}
