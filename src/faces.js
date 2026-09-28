// Cartoon faces drawn on canvas: used as head textures (equirectangular
// wrap on a sphere) and as 2D portraits for the UI.

import * as THREE from 'three';

const texCache = new Map();
const portraitCache = new Map();

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f));
  const b = Math.max(0, Math.min(255, (n & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/**
 * Draw a face centred on (cx, cy). `s` scales everything (1 = texture size,
 * eyes ~ 44px apart). Expression is one of EXPRESSIONS.
 */
export function drawFace(ctx, cx, cy, s, expr, p) {
  const c = p.colors;
  const hair = c.hair;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  // ---- beard / stubble
  if (p.beard && p.beard !== 'none') {
    ctx.save();
    ctx.beginPath();
    if (p.beard === 'goatee') {
      ctx.ellipse(0, 78, 22, 20, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(hair, 0.85);
    } else {
      ctx.ellipse(0, 52, 92, 62, 0, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.fillStyle = rgba(hair, p.beard === 'full' ? 0.85 : 0.3);
    }
    ctx.fill();
    ctx.restore();
  }

  // ---- cheeks
  if (expr === 'happy' || expr === 'smug') {
    ctx.fillStyle = 'rgba(255,90,90,0.22)';
    ctx.beginPath(); ctx.ellipse(-62, 30, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(62, 30, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---- eyes
  const eyeY = -18;
  const eyeDX = 44;
  const eyeShape = {
    neutral: { w: 20, h: 24, lid: 0, pupil: 1, look: [0, 0] },
    focus: { w: 20, h: 20, lid: 0.35, pupil: 1, look: [0, 2] },
    happy: { w: 22, h: 26, lid: 0, pupil: 1.05, look: [0, -2] },
    sad: { w: 20, h: 26, lid: 0.25, pupil: 1.15, look: [0, 6] },
    angry: { w: 22, h: 18, lid: 0.5, pupil: 0.9, look: [0, 1] },
    shock: { w: 24, h: 30, lid: 0, pupil: 0.6, look: [0, 0] },
    smug: { w: 21, h: 18, lid: 0.55, pupil: 1, look: [4, 0] },
  }[expr] || { w: 20, h: 24, lid: 0, pupil: 1, look: [0, 0] };

  for (const side of [-1, 1]) {
    const ex = side * eyeDX;
    const happyClosed = expr === 'happy';
    if (happyClosed) {
      // closed, upturned "^" eyes
      ctx.strokeStyle = '#1b1210';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, eyeY + 8, 14, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      continue;
    }
    // white
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(ex, eyeY, eyeShape.w, eyeShape.h, 0, 0, Math.PI * 2); ctx.fill();
    // iris + pupil
    const ix = ex + eyeShape.look[0] + (expr === 'smug' ? 0 : 0);
    const iy = eyeY + eyeShape.look[1];
    ctx.fillStyle = c.eyes || '#3b2412';
    ctx.beginPath(); ctx.ellipse(ix, iy, 10 * eyeShape.pupil, 11 * eyeShape.pupil, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b0705';
    ctx.beginPath(); ctx.ellipse(ix, iy, 5.5 * eyeShape.pupil, 6 * eyeShape.pupil, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.ellipse(ix + 3, iy - 4, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
    // lid (skin coloured) cuts the eye from the top
    if (eyeShape.lid > 0) {
      ctx.fillStyle = c.skin;
      ctx.beginPath();
      const lidH = eyeShape.h * 2 * eyeShape.lid;
      const tilt = expr === 'angry' ? side * 6 : (expr === 'smug' && side === 1 ? 6 : 0);
      ctx.moveTo(ex - eyeShape.w - 2, eyeY - eyeShape.h - 2);
      ctx.lineTo(ex + eyeShape.w + 2, eyeY - eyeShape.h - 2);
      ctx.lineTo(ex + eyeShape.w + 2, eyeY - eyeShape.h + lidH + tilt);
      ctx.lineTo(ex - eyeShape.w - 2, eyeY - eyeShape.h + lidH - tilt);
      ctx.closePath();
      ctx.fill();
    }
    // outline
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(ex, eyeY, eyeShape.w, eyeShape.h, 0, 0, Math.PI * 2); ctx.stroke();
    // tears
    if (expr === 'sad') {
      ctx.fillStyle = 'rgba(90,170,255,0.9)';
      ctx.beginPath(); ctx.ellipse(ex + side * 12, eyeY + 34, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex + side * 14, eyeY + 56, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- brows
  ctx.strokeStyle = shade(hair, 0.8);
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = side * eyeDX;
    let inner = -48, outer = -48, y = 0; // offsets relative to eye Y; inner = toward nose
    switch (expr) {
      case 'neutral': inner = -46; outer = -46; break;
      case 'focus': inner = -36; outer = -48; break;
      case 'happy': inner = -54; outer = -54; break;
      case 'sad': inner = -58; outer = -44; break;
      case 'angry': inner = -28; outer = -50; break;
      case 'shock': inner = -64; outer = -60; break;
      case 'smug': inner = side === 1 ? -62 : -42; outer = side === 1 ? -56 : -46; break;
    }
    ctx.beginPath();
    ctx.moveTo(bx - side * 20, eyeY + inner + y);
    ctx.lineTo(bx + side * 22, eyeY + outer + y);
    ctx.stroke();
  }

  // ---- nose
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(-8, 22); ctx.lineTo(4, 24); ctx.stroke();

  // ---- mouth
  const my = 52;
  ctx.lineCap = 'round';
  switch (expr) {
    case 'happy': {
      ctx.fillStyle = '#5a1a1a';
      ctx.beginPath(); ctx.arc(0, my - 6, 30, 0, Math.PI); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-26, my - 6, 52, 9);
      ctx.fillStyle = '#e0505a';
      ctx.beginPath(); ctx.ellipse(0, my + 14, 14, 8, 0, 0, Math.PI); ctx.fill();
      break;
    }
    case 'sad': {
      ctx.strokeStyle = '#3a1414'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, my + 26, 24, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
      break;
    }
    case 'angry': {
      ctx.fillStyle = '#3a1414';
      ctx.fillRect(-26, my - 4, 52, 16);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) ctx.fillRect(-24 + i * 10, my - 2, 8, 5);
      break;
    }
    case 'shock': {
      ctx.fillStyle = '#3a1414';
      ctx.beginPath(); ctx.ellipse(0, my + 4, 16, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0505a';
      ctx.beginPath(); ctx.ellipse(0, my + 18, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'smug': {
      ctx.strokeStyle = '#3a1414'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-20, my + 2); ctx.quadraticCurveTo(6, my + 10, 26, my - 8); ctx.stroke();
      break;
    }
    case 'focus': {
      ctx.strokeStyle = '#3a1414'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-18, my + 2); ctx.lineTo(18, my + 2); ctx.stroke();
      break;
    }
    default: {
      ctx.strokeStyle = '#3a1414'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, my - 8, 22, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    }
  }

  // ---- ears (drawn last, at the sides)
  ctx.fillStyle = shade(p.colors.skin, 0.92);
  ctx.beginPath(); ctx.ellipse(-236, 4, 14, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(236, 4, 14, 20, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

/** Equirectangular head texture with the face at u = 0.5 (+x in three.js SphereGeometry). */
export function faceTexture(p, expr) {
  const key = `${p.id}:${expr}`;
  if (texCache.has(key)) return texCache.get(key);
  const W = 1024, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // base skin with a subtle vertical shading
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(p.colors.skin, 1.06));
  g.addColorStop(0.55, p.colors.skin);
  g.addColorStop(1, shade(p.colors.skin, 0.82));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawFace(ctx, W / 2, H / 2 - 10, 1.05, expr, p);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

/** Small 2D portrait (data URL) for menus and the HUD. */
export function portrait(p, expr = 'neutral', size = 160) {
  const key = `${p.id}:${expr}:${size}`;
  if (portraitCache.has(key)) return portraitCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  const cx = size / 2, cy = size * 0.5, R = size * 0.36;
  // jersey collar
  ctx.fillStyle = p.colors.jersey;
  ctx.beginPath(); ctx.ellipse(cx, size * 0.98, size * 0.34, size * 0.22, 0, Math.PI, 0); ctx.fill();
  // head
  ctx.fillStyle = p.colors.skin;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // hair
  ctx.fillStyle = p.colors.hair;
  ctx.beginPath();
  switch (p.hair) {
    case 'buzz': ctx.arc(cx, cy, R * 1.02, Math.PI * 1.08, Math.PI * 1.92); ctx.closePath(); break;
    case 'long': ctx.arc(cx, cy - R * 0.05, R * 1.08, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(cx + R * 1.05, cy + R * 0.7); ctx.lineTo(cx - R * 1.05, cy + R * 0.7); ctx.closePath(); break;
    case 'curly': ctx.arc(cx, cy - R * 0.1, R * 1.12, Math.PI * 1.0, Math.PI * 2.0); ctx.closePath(); break;
    case 'mohawk': ctx.arc(cx, cy, R * 1.02, Math.PI * 1.15, Math.PI * 1.85); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx, cy - R * 1.05, R * 0.28, R * 0.25, 0, 0, Math.PI * 2); break;
    case 'bun': ctx.arc(cx, cy, R * 1.04, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(cx, cy - R * 1.05, R * 0.22, 0, Math.PI * 2); break;
    case 'quiff': ctx.arc(cx, cy, R * 1.04, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx - R * 0.1, cy - R * 1.0, R * 0.42, R * 0.22, -0.3, 0, Math.PI * 2); break;
    default: ctx.arc(cx, cy, R * 1.04, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath();
  }
  ctx.fill();
  if (p.hair === 'headband') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - R * 0.98, cy - R * 0.55, R * 1.96, R * 0.17);
  }
  // clip the face to the head circle so ears etc. do not spill
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2); ctx.clip();
  drawFace(ctx, cx, cy + R * 0.05, R / 130, expr, p);
  ctx.restore();
  const url = cv.toDataURL();
  portraitCache.set(key, url);
  return url;
}
