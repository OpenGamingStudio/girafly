import { CEIL, FLOOR, PATH_PAD, SEG_LEN } from './config';
import { K_ACACIA, K_LASER, Obs, newObs, playerGap, PY_MAX, PY_MIN } from './geom';
import { Rng } from './rng';

export const B_SHIELD = 0;
export const B_MAGNET = 1;
export const B_BALLOON = 2;
const MAX_OBS = 12;
const MAX_COINS = 72;

/** Segment généré (structure réutilisée, aucune allocation pendant la partie). */
export interface Seg {
  x0: number;
  len: number;
  yIn: number;
  yOut: number;
  nObs: number;
  obs: Obs[];
  nCoins: number;
  cx: Float32Array;
  cy: Float32Array;
  nBonus: number;
  bx: Float32Array;
  by: Float32Array;
  bk: Uint8Array;
}

export function newSeg(): Seg {
  const obs: Obs[] = [];
  for (let i = 0; i < MAX_OBS; i++) obs.push(newObs());
  return {
    x0: 0, len: SEG_LEN, yIn: 0, yOut: 0, nObs: 0, obs,
    nCoins: 0, cx: new Float32Array(MAX_COINS), cy: new Float32Array(MAX_COINS),
    nBonus: 0, bx: new Float32Array(2), by: new Float32Array(2), bk: new Uint8Array(2),
  };
}

/** Trajectoire garantie : hauteur du corps de Gigi à l'abscisse x du segment (lissée). */
export function pathY(s: Seg, x: number): number {
  let t = (x - s.x0) / s.len;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const k = t * t * (3 - 2 * t);
  return s.yIn + (s.yOut - s.yIn) * k;
}

/** Pente maximale de la trajectoire (unités de hauteur par unité de distance) = 1,5 × Δ/len. */
export const MAX_PATH_DELTA = 100;

export function pathClear(s: Seg, o: Obs, pad = PATH_PAD): boolean {
  for (let x = s.x0; x <= s.x0 + s.len; x += 2) {
    if (playerGap(x, pathY(s, x), 0, o, pad) < 0) return false;
  }
  return true;
}

const clampY = (v: number) => (v < PY_MIN + 8 ? PY_MIN + 8 : v > PY_MAX - 8 ? PY_MAX - 8 : v);

// Silhouette de girafe en pièces (7 colonnes × 7 lignes).
const GIRAFFE = [
  '..#.#..',
  '.#####.',
  '..###..',
  '..##...',
  '..##...',
  '#####..',
  '#####..',
];

export interface GenOpts {
  /** 0 → 1 : montée en difficulté. */
  diff: number;
  /** Segment d'accueil : pas d'obstacle. */
  calm: boolean;
  /** Pondération des bonus bouclier (amélioration de la boutique). */
  shieldChance: number;
}

function addCoin(s: Seg, x: number, y: number): void {
  if (s.nCoins >= s.cx.length) return;
  if (y < CEIL + 10 || y > FLOOR - 10) return;
  s.cx[s.nCoins] = x;
  s.cy[s.nCoins] = y;
  s.nCoins++;
}

function placeObs(s: Seg, r: Rng, diff: number): void {
  const tries = 3 + Math.floor(diff * 6);
  const want = 1 + Math.floor(diff * 4) + (r.chance(0.5) ? 1 : 0);
  for (let i = 0; i < tries && s.nObs < Math.min(want, MAX_OBS); i++) {
    const o = s.obs[s.nObs];
    o.active = true;
    o.grazed = false;
    o.vx = 0;
    const cx = s.x0 + r.range(60, s.len - 40);
    if (r.chance(0.34)) {
      // branche d'acacia électrifiée, du plafond ou du sol
      o.kind = K_ACACIA;
      o.r = 9;
      const top = r.chance(0.5);
      const len = r.range(60, 170);
      o.x1 = cx;
      o.y1 = top ? CEIL : FLOOR;
      o.x2 = cx + r.range(-24, 24);
      o.y2 = top ? CEIL + len : FLOOR - len;
    } else {
      // barre laser fixe : horizontale, verticale ou diagonale
      o.kind = K_LASER;
      o.r = 4;
      const ang = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4][r.int(0, 3)];
      const half = r.range(26, 56);
      const cy = r.range(CEIL + 40, FLOOR - 40);
      o.x1 = cx - Math.cos(ang) * half;
      o.y1 = cy - Math.sin(ang) * half;
      o.x2 = cx + Math.cos(ang) * half;
      o.y2 = cy + Math.sin(ang) * half;
    }
    if (pathClear(s, o)) s.nObs++;
    else o.active = false;
  }
}

function placeCoins(s: Seg, r: Rng): void {
  const p = r.int(0, 3);
  const x = s.x0 + 70;
  if (p === 0) {
    for (let i = 0; i < 9; i++) addCoin(s, x + i * 18, pathY(s, x + i * 18));
  } else if (p === 1) {
    for (let i = 0; i < 12; i++) addCoin(s, x + i * 16, pathY(s, x + i * 16) + Math.sin(i * 0.9) * 34);
  } else if (p === 2) {
    const cx = s.x0 + 120;
    const cy = pathY(s, cx);
    for (let row = 0; row < GIRAFFE.length; row++)
      for (let col = 0; col < GIRAFFE[row].length; col++)
        if (GIRAFFE[row][col] === '#') addCoin(s, cx + col * 14, cy - 42 + row * 14);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = (i / 9) * Math.PI;
      addCoin(s, x + 20 + i * 16, pathY(s, x + 20 + i * 16) - Math.sin(a) * 40);
    }
  }
  // les pièces qui touchent un obstacle sont retirées
  let w = 0;
  for (let i = 0; i < s.nCoins; i++) {
    let ok = true;
    for (let j = 0; j < s.nObs && ok; j++) {
      const o = s.obs[j];
      if (coinTouches(s.cx[i], s.cy[i], o)) ok = false;
    }
    if (ok) {
      s.cx[w] = s.cx[i];
      s.cy[w] = s.cy[i];
      w++;
    }
  }
  s.nCoins = w;
}

function coinTouches(x: number, y: number, o: Obs): boolean {
  const dx = o.x2 - o.x1;
  const dy = o.y2 - o.y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((x - o.x1) * dx + (y - o.y1) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = o.x1 + t * dx - x;
  const ey = o.y1 + t * dy - y;
  return Math.sqrt(ex * ex + ey * ey) < o.r + 12;
}

/** Remplit `s` : un segment qui commence en (x0, yIn). Il existe toujours une trajectoire libre (pathY). */
export function generate(s: Seg, r: Rng, x0: number, yIn: number, o: GenOpts): void {
  s.x0 = x0;
  s.len = SEG_LEN;
  s.yIn = clampY(yIn);
  s.yOut = clampY(s.yIn + r.range(-MAX_PATH_DELTA, MAX_PATH_DELTA));
  s.nObs = 0;
  s.nCoins = 0;
  s.nBonus = 0;
  if (!o.calm) placeObs(s, r, o.diff);
  placeCoins(s, r);
  if (!o.calm) {
    const x = s.x0 + r.range(120, 240);
    const roll = r.next();
    let k = -1;
    if (roll < o.shieldChance * 0.5) k = B_SHIELD;
    else if (roll < o.shieldChance * 0.5 + 0.1) k = B_MAGNET;
    else if (roll < o.shieldChance * 0.5 + 0.15) k = B_BALLOON;
    if (k >= 0) {
      s.bx[0] = x;
      s.by[0] = pathY(s, x);
      s.bk[0] = k;
      s.nBonus = 1;
    }
  }
}
