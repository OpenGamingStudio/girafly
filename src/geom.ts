import { CEIL, FLOOR } from './config';

export const K_LASER = 0;
export const K_ACACIA = 1;
export const K_MISSILE = 2;
export const K_BEAM = 3;
export const K_METEOR = 4;

/** Obstacle = capsule (segment épaissi). Objet réutilisable (pool). */
export interface Obs {
  active: boolean;
  kind: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  r: number;
  vx: number;
  vy: number;
  /** Porte mobile : amplitude, pulsation, phase et ordonnées de base (amp = 0 : fixe). */
  amp: number;
  w: number;
  ph: number;
  b1: number;
  b2: number;
  grazed: boolean;
}

export function newObs(): Obs {
  return { active: false, kind: 0, x1: 0, y1: 0, x2: 0, y2: 0, r: 0, vx: 0, vy: 0, amp: 0, w: 0, ph: 0, b1: 0, b2: 0, grazed: false };
}

export function segDist2(cx: number, cy: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = x1 + t * dx - cx;
  const ey = y1 + t * dy - cy;
  return ex * ex + ey * ey;
}

// Silhouette de Gigi : deux cercles de corps + la tête. Le cou est exclu de la hitbox.
export const BODY_R = 12;
export const BODY2_R = 9;
export const HEAD_R = 9;
const HEAD_X0 = 12;
const HEAD_Y0 = -30;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const headDX = (vy: number) => HEAD_X0 + clamp(-vy * 0.03, -4, 8);
export const headDY = (vy: number) => HEAD_Y0 + clamp(vy * 0.025, -4, 8);

/** Plus petite distance entre un cercle (tête / corps) et la capsule, moins les rayons : < 0 = contact. */
export function circleGap(cx: number, cy: number, cr: number, o: Obs, pad = 0): number {
  return Math.sqrt(segDist2(cx, cy, o.x1, o.y1, o.x2, o.y2)) - o.r - cr - pad;
}

/** Écart minimal de Gigi (corps + tête) à une capsule. */
export function playerGap(px: number, py: number, vy: number, o: Obs, pad = 0): number {
  const a = circleGap(px, py + 2, BODY_R, o, pad);
  const b = circleGap(px - 8, py + 8, BODY2_R, o, pad);
  const c = circleGap(px + headDX(vy), py + headDY(vy), HEAD_R, o, pad);
  return Math.min(a, b, c);
}

/** Gigi doit rester entre plafond et sol : bornes de py. */
export const PY_MIN = CEIL + 42;
export const PY_MAX = FLOOR - 14;
