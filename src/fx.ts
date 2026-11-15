// Particules visuelles (fumée du jetpack, étincelles, pièces, explosions, poussière) : pool de tableaux typés,
// rien n'est créé par image. Aplats vifs uniquement. Mouvement réduit : trois fois moins de particules, sans secousse.
import { INK } from './art';

export const FX_SMOKE = 0;
export const FX_SPARK = 1;
export const FX_COIN = 2;
export const FX_BOOM = 3;
export const FX_DUST = 4;

const N = 220;
const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
const life = new Float32Array(N), max = new Float32Array(N), size = new Float32Array(N);
const kind = new Uint8Array(N), col = new Uint8Array(N);
let next = 0;
let seed = 1234567;
const rnd = (): number => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 10000) / 10000; };

const BOOM_COLS = ['#ff3d5a', '#ffd23f', '#ff8a2a', '#ffffff'];
const COIN_COLS = ['#ffc928', '#fff1a8', '#ffffff'];
const SMOKE_COLS = ['#e8e4f0', '#c9c4d8'];

function spawn(k: number, px: number, py: number, sx: number, sy: number, l: number, s: number, c: number): void {
  const i = next;
  next = (next + 1) % N;
  kind[i] = k; x[i] = px; y[i] = py; vx[i] = sx; vy[i] = sy; life[i] = max[i] = l; size[i] = s; col[i] = c;
}

/** Fumée du jetpack (un petit nuage). */
export function smoke(px: number, py: number): void { spawn(FX_SMOKE, px, py, -30 - rnd() * 20, 15 + rnd() * 15, 0.32, 2.5 + rnd() * 1.5, rnd() > 0.5 ? 1 : 0); }
/** Étincelles jaunes. */
export function sparks(px: number, py: number, n: number, reduce: boolean): void {
  const m = reduce ? Math.ceil(n / 3) : n;
  for (let i = 0; i < m; i++) { const a = rnd() * 6.283, v = 60 + rnd() * 100; spawn(FX_SPARK, px, py, Math.cos(a) * v, Math.sin(a) * v, 0.35 + rnd() * 0.2, 3, 0); }
}
/** Pièce ramassée : étoiles dorées qui montent. */
export function coinBurst(px: number, py: number, reduce: boolean): void {
  const m = reduce ? 2 : 6;
  for (let i = 0; i < m; i++) spawn(FX_COIN, px, py, (rnd() - 0.5) * 120, -50 - rnd() * 70, 0.5, 4 + rnd() * 2, i % 3);
}
/** Explosion (missile, coup) : éclats ronds rouge, jaune, orange. */
export function boom(px: number, py: number, reduce: boolean): void {
  const m = reduce ? 8 : 22;
  for (let i = 0; i < m; i++) { const a = rnd() * 6.283, v = 40 + rnd() * 190; spawn(FX_BOOM, px, py, Math.cos(a) * v, Math.sin(a) * v, 0.4 + rnd() * 0.35, 4 + rnd() * 6, i % 4); }
}
/** Poussière au sol. */
export function dust(px: number, py: number): void { spawn(FX_DUST, px, py, -60 - rnd() * 40, -10 - rnd() * 20, 0.45, 3 + rnd() * 2, 0); }

export function clearFx(): void { life.fill(0); }
/** Nombre de particules vivantes (tests). */
export function liveCount(): number { let n = 0; for (let i = 0; i < N; i++) if (life[i] > 0) n++; return n; }

export function updateFx(dt: number): void {
  for (let i = 0; i < N; i++) {
    if (life[i] <= 0) continue;
    life[i] -= dt;
    x[i] += vx[i] * dt; y[i] += vy[i] * dt;
    if (kind[i] === FX_BOOM || kind[i] === FX_SPARK) { vy[i] += 260 * dt; vx[i] *= 0.97; }
    else if (kind[i] === FX_COIN) vy[i] += 90 * dt;
  }
}

export function drawFx(c: CanvasRenderingContext2D, cam: number): void {
  c.lineWidth = 1.6; c.strokeStyle = INK;
  for (let i = 0; i < N; i++) {
    if (life[i] <= 0) continue;
    const k = life[i] / max[i], px = x[i] - cam, py = y[i];
    switch (kind[i]) {
      case FX_SMOKE: case FX_DUST: {
        const r = size[i] * (kind[i] === FX_SMOKE ? 1 + (1 - k) * 1.6 : 1 + (1 - k));
        c.beginPath(); c.arc(px, py, r, 0, 6.3); c.fillStyle = kind[i] === FX_DUST ? '#f6e3b0' : SMOKE_COLS[col[i]]; c.fill(); if (r > 4) c.stroke();
        break;
      }
      case FX_SPARK: c.fillStyle = '#ffd23f'; c.fillRect(px - 1.5, py - 1.5, 3 * (0.4 + k), 3 * (0.4 + k)); break;
      case FX_COIN: {
        const r = size[i] * (0.5 + k);
        c.beginPath();
        for (let j = 0; j < 8; j++) { const a = -1.5708 + j * 0.7854, rr = j % 2 ? r * 0.45 : r; c.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); }
        c.closePath(); c.fillStyle = COIN_COLS[col[i]]; c.fill();
        break;
      }
      default: {
        const r = size[i] * (0.4 + k * 0.6);
        c.beginPath(); c.arc(px, py, r, 0, 6.3); c.fillStyle = BOOM_COLS[col[i]]; c.fill(); if (r > 5) c.stroke();
      }
    }
  }
}
