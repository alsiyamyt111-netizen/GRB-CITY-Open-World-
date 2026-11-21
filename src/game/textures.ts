// Procedural canvas textures (asphalt, facades, grass, sidewalk, water normal) – keeps the bundle small
import * as THREE from 'three';

function canvas(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, repeat = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function noise(c: CanvasRenderingContext2D, w: number, h: number, base: [number, number, number], amp: number, n = 6000) {
  c.fillStyle = `rgb(${base})`; c.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { const v = (Math.random() - 0.5) * amp; c.fillStyle = `rgba(${v > 0 ? '255,255,255' : '0,0,0'},${Math.abs(v) / 255})`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
}
const cache: Record<string, THREE.Texture> = {};
const memo = (k: string, f: () => THREE.Texture) => cache[k] || (cache[k] = f());

export const tex = {
  asphalt: () => memo('asphalt', () => canvas(256, 256, c => noise(c, 256, 256, [52, 54, 58], 50, 9000))),
  road: () => memo('road', () => canvas(256, 256, c => {
    noise(c, 256, 256, [50, 52, 56], 45, 8000);
    c.fillStyle = '#e8c547'; c.fillRect(124, 0, 3, 256); c.fillRect(130, 0, 3, 256);
    c.fillStyle = '#ddd'; c.fillRect(6, 0, 3, 256); c.fillRect(247, 0, 3, 256);
    for (let y = 0; y < 256; y += 64) { c.fillRect(62, y, 3, 34); c.fillRect(191, y, 3, 34); }
  })),
  sidewalk: () => memo('sidewalk', () => canvas(128, 128, c => {
    noise(c, 128, 128, [150, 148, 142], 40, 3000);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(128, i); c.stroke(); }
  })),
  grass: () => memo('grass', () => canvas(256, 256, c => {
    noise(c, 256, 256, [70, 110, 45], 60, 14000);
    for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(${30 + Math.random() * 40},${80 + Math.random() * 60},20,0.6)`; c.fillRect(Math.random() * 256, Math.random() * 256, 1, 3); }
  })),
  facade: (kind: number, night = false) => memo('facade' + kind + night, () => canvas(128, 256, c => {
    const bases = ['#8a8f99', '#c9c2b5', '#5d6b7a', '#a3593f', '#e0ddd5', '#3d4752'];
    c.fillStyle = night ? '#000' : bases[kind % bases.length]; c.fillRect(0, 0, 128, 256);
    if (!night) noise(c, 128, 256, hexRgb(bases[kind % bases.length]), 25, 1500);
    const glass = kind % 3 === 2;
    for (let y = 6; y < 256; y += 16) for (let x = 6; x < 128; x += glass ? 20 : 16) {
      if (night) { const lit = Math.random() < 0.35; c.fillStyle = lit ? `rgba(255,${200 + Math.random() * 50},${120 + Math.random() * 80},1)` : '#000'; }
      else c.fillStyle = glass ? `rgba(${60 + Math.random() * 30},${100 + Math.random() * 30},${140 + Math.random() * 40},1)` : `rgba(${30 + Math.random() * 40},${45 + Math.random() * 40},${60 + Math.random() * 40},1)`;
      c.fillRect(x, y, glass ? 16 : 9, 10);
    }
  })),
  water: () => memo('water', () => {
    const t = canvas(256, 256, c => {
      const img = c.createImageData(256, 256);
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        const nx = Math.sin(x * 0.15 + Math.sin(y * 0.07) * 2) * 0.5 + Math.sin((x + y) * 0.09) * 0.3;
        const ny = Math.cos(y * 0.13 + Math.sin(x * 0.05) * 2) * 0.5 + Math.cos((x - y) * 0.11) * 0.3;
        const i = (y * 256 + x) * 4; img.data[i] = 128 + nx * 60; img.data[i + 1] = 128 + ny * 60; img.data[i + 2] = 255; img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    });
    t.colorSpace = THREE.NoColorSpace; return t;
  }),
  cloud: () => memo('cloud', () => canvas(256, 128, c => {
    for (let i = 0; i < 40; i++) { const x = 40 + Math.random() * 176, y = 40 + Math.random() * 48, r = 15 + Math.random() * 30; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 128); }
  }, false)),
};
function hexRgb(h: string): [number, number, number] { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
