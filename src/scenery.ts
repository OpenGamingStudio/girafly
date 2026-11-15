// Décors à parallaxe (4 couches par biome) : aplats vifs, contours nets, aucun dégradé.
import { CEIL, FLOOR, H } from './config';
import { INK } from './art';
import type { Game } from './sim';

export interface Scene {
  w: number;
  reduce: boolean;
}

interface Pal {
  sky: string; sun: string; far: string; mid: string; near: string; ground: string; ground2: string; ceil: string; cloud: string; accent: string;
}

/** Les trois biomes (savane, ville au crépuscule, espace). */
export const PALS: Pal[] = [
  { sky: '#7fd4ff', sun: '#ffe066', far: '#9be3c0', mid: '#5cc48a', near: '#2fa35b', ground: '#f2c86b', ground2: '#d9a441', ceil: '#5cc48a', cloud: '#ffffff', accent: '#ff7a3d' },
  { sky: '#ffb36b', sun: '#fff0a8', far: '#e9785a', mid: '#a8433a', near: '#6e2d3a', ground: '#8a5a68', ground2: '#6e4553', ceil: '#6e2d3a', cloud: '#ffe1c2', accent: '#ffd23f' },
  { sky: '#2a2d7a', sun: '#ffe066', far: '#4a4fb0', mid: '#363b94', near: '#262a6b', ground: '#8f7bd6', ground2: '#6f5cb0', ceil: '#262a6b', cloud: '#a9acf0', accent: '#5af0d0' },
];

export const biomeOf = (dist: number): number => Math.floor(dist / 500) % PALS.length;

const mod = (a: number, b: number) => ((a % b) + b) % b;
/** Hasard stable par indice (0 à 1) : les motifs se répètent à l'identique sans état. */
const hash = (i: number): number => (Math.imul(i + 1, 2654435761) >>> 8 & 1023) / 1023;
/** Abscisse d'un élément de couche : espacement fixe, défilement k, bouclage sur la largeur visible. */
const px = (i: number, gap: number, cam: number, k: number, w: number, margin: number): number => mod(i * gap - cam * k, w + 2 * margin) - margin;

type Ctx = CanvasRenderingContext2D;
const OUT = 2.2;

function disc(c: Ctx, x: number, y: number, r: number, fill: string, stroke = false): void {
  c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fillStyle = fill; c.fill();
  if (stroke) { c.lineWidth = OUT; c.strokeStyle = INK; c.stroke(); }
}
function blob(c: Ctx, x: number, y: number, s: number, fill: string): void {
  c.beginPath(); c.ellipse(x, y, 34 * s, 10 * s, 0, 0, 6.3); c.ellipse(x + 18 * s, y - 7 * s, 20 * s, 9 * s, 0, 0, 6.3); c.ellipse(x - 16 * s, y - 4 * s, 16 * s, 7 * s, 0, 0, 6.3);
  c.fillStyle = fill; c.fill();
}

// ---------- couches ----------
function savane(c: Ctx, p: Pal, g: Game, s: Scene, cam: number, t: number): void {
  disc(c, s.w * 0.78, 78, 30, p.sun);
  for (let i = 0; i < 6; i++) blob(c, px(i, 190, cam, 0.06, s.w, 100) + (s.reduce ? 0 : t * 4) % 30, 50 + hash(i) * 90, 1, p.cloud);
  // 1 : collines lointaines
  c.fillStyle = p.far;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(px(i, 260, cam, 0.12, s.w, 200), FLOOR, 170, 70 + hash(i) * 40, 0, Math.PI, 0); c.fill(); }
  // 2 : baobabs (silhouettes)
  for (let i = 0; i < 4; i++) {
    const x = px(i, 330, cam, 0.22, s.w, 120), h = 70 + hash(i + 9) * 30;
    c.fillStyle = p.mid; c.fillRect(x - 9, FLOOR - h, 18, h);
    c.beginPath(); c.ellipse(x, FLOOR - h, 34, 14, 0, 0, 6.3); c.fill();
  }
  // 3 : acacias avec contour
  for (let i = 0; i < 6; i++) {
    const x = px(i, 210, cam, 0.42, s.w, 100), k = 1 + hash(i + 3) * 0.5;
    c.fillStyle = '#6b4a2a'; c.fillRect(x - 2 * k, FLOOR - 30 * k, 4 * k, 30 * k);
    c.beginPath(); c.ellipse(x, FLOOR - 32 * k, 24 * k, 7 * k, 0, 0, 6.3); c.fillStyle = p.near; c.fill(); c.lineWidth = 1.8; c.strokeStyle = INK; c.stroke();
  }
  // 4 : touffes d'herbe au premier plan
  c.fillStyle = p.near;
  for (let i = 0; i < 12; i++) {
    const x = px(i, 96, cam, 0.8, s.w, 60), h = 8 + hash(i + 5) * 8;
    c.beginPath(); c.moveTo(x - 7, FLOOR); c.lineTo(x - 3, FLOOR - h); c.lineTo(x, FLOOR - 3); c.lineTo(x + 3, FLOOR - h * 1.2); c.lineTo(x + 7, FLOOR); c.closePath(); c.fill();
  }
}

function skyline(c: Ctx, p: Pal, i0: number, n: number, gap: number, cam: number, k: number, w: number, hMin: number, hSpan: number, fill: string, lit: boolean, t: number): void {
  for (let i = i0; i < i0 + n; i++) {
    const x = px(i, gap, cam, k, w, 90), bw = gap * 0.7, bh = hMin + hash(i) * hSpan;
    c.fillStyle = fill; c.fillRect(x, FLOOR - bh, bw, bh);
    if (lit) {
      c.fillStyle = p.accent;
      for (let r = 0; r < bh / 18 - 1; r++) for (let q = 0; q < 3; q++) if (hash(i * 31 + r * 7 + q + Math.floor(t * 0.15)) > 0.45) c.fillRect(x + 6 + q * (bw - 12) / 3, FLOOR - bh + 8 + r * 18, 6, 8);
    }
    if (hash(i + 20) > 0.6) { c.fillStyle = fill; c.fillRect(x + bw / 2 - 1.5, FLOOR - bh - 14, 3, 14); }
  }
}
function ville(c: Ctx, p: Pal, g: Game, s: Scene, cam: number, t: number): void {
  disc(c, s.w * 0.7, 120, 44, p.sun);
  for (let i = 0; i < 5; i++) blob(c, px(i, 220, cam, 0.05, s.w, 100), 46 + hash(i + 2) * 70, 1.1, p.cloud);
  skyline(c, p, 0, 9, 74, cam, 0.12, s.w, 70, 90, p.far, false, t);
  skyline(c, p, 40, 7, 96, cam, 0.26, s.w, 90, 100, p.mid, false, t);
  skyline(c, p, 80, 6, 120, cam, 0.46, s.w, 70, 90, p.near, true, t);
  // 4 : réverbères au premier plan
  for (let i = 0; i < 5; i++) {
    const x = px(i, 190, cam, 0.8, s.w, 60);
    c.fillStyle = INK; c.fillRect(x - 1.5, FLOOR - 52, 3, 52); c.fillRect(x - 1.5, FLOOR - 52, 12, 3);
    c.fillStyle = p.accent; c.fillRect(x + 6, FLOOR - 49, 8, 5);
  }
}

function espace(c: Ctx, p: Pal, g: Game, s: Scene, cam: number, t: number): void {
  // 1 : étoiles (clignotent sauf mouvement réduit)
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 36; i++) {
    const x = px(i, 53, cam, 0.04, s.w, 20), y = CEIL + 20 + hash(i + 7) * (FLOOR - CEIL - 40);
    const big = hash(i + 1) > 0.8;
    if (!s.reduce && Math.floor(t * 2 + i) % 5 === 0) continue;
    c.fillRect(x, y, big ? 3 : 2, big ? 3 : 2);
  }
  // 2 : planète à anneau
  const ex = px(0, 700, cam, 0.1, s.w, 160);
  disc(c, ex, 130, 46, p.accent, true);
  c.fillStyle = INK; c.beginPath(); c.ellipse(ex, 130, 76, 12, -0.3, 0, 6.3); c.lineWidth = 6; c.strokeStyle = INK; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#ffe066'; c.stroke();
  disc(c, px(1, 700, cam, 0.1, s.w, 160), 240, 22, '#ff7a9c', true);
  // 3 : astéroïdes lointains
  for (let i = 0; i < 7; i++) {
    const x = px(i, 160, cam, 0.3, s.w, 60), y = 70 + hash(i + 11) * 220, r = 7 + hash(i) * 8;
    c.beginPath(); c.moveTo(x - r, y); c.lineTo(x - r * 0.4, y - r); c.lineTo(x + r * 0.7, y - r * 0.7); c.lineTo(x + r, y + r * 0.2); c.lineTo(x, y + r); c.closePath();
    c.fillStyle = p.far; c.fill(); c.lineWidth = 1.8; c.strokeStyle = INK; c.stroke();
  }
  // 4 : cratères et rochers au sol
  c.fillStyle = p.mid;
  for (let i = 0; i < 6; i++) { const x = px(i, 150, cam, 0.8, s.w, 70); c.beginPath(); c.ellipse(x, FLOOR, 22 + hash(i) * 16, 7 + hash(i + 4) * 8, 0, Math.PI, 0); c.fill(); }
}

const LAYERS = [savane, ville, espace];

export function drawBackground(c: Ctx, g: Game, s: Scene, t: number): void {
  const b = biomeOf(g.dist), p = PALS[b];
  const cam = g.camX * (s.reduce ? 0.35 : 1);
  c.fillStyle = p.sky; c.fillRect(0, 0, s.w, H);
  LAYERS[b](c, p, g, s, cam, t);
  // sol et plafond
  c.fillStyle = p.ground; c.fillRect(0, FLOOR, s.w, H - FLOOR);
  c.fillStyle = p.ground2; c.fillRect(0, FLOOR, s.w, 5);
  c.fillStyle = INK; c.fillRect(0, FLOOR - 1, s.w, 2);
  for (let i = 0; i < 14; i++) { const x = mod(i * 64 - g.camX, s.w + 128) - 64; c.fillStyle = p.ground2; c.fillRect(x, FLOOR + 12 + (i % 3) * 6, 18, 3); }
  c.fillStyle = p.ceil; c.fillRect(0, 0, s.w, CEIL);
  c.fillStyle = INK; c.fillRect(0, CEIL - 1, s.w, 2);
  for (let i = 0; i < 18; i++) { const x = mod(i * 48 - g.camX, s.w + 96) - 48; c.fillStyle = p.ceil; c.beginPath(); c.ellipse(x, CEIL - 1, 18, 9 + (i % 3) * 3, 0, 0, Math.PI); c.fill(); }
}
