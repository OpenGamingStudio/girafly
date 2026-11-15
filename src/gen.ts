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
  /** Rampe d'accueil : seulement quelques obstacles simples. */
  ramp?: boolean;
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

export type Pattern = 'scatter' | 'corridor' | 'zigzag' | 'gate';

/** Le « director » : choisit un pattern selon la difficulté courante (0 → 1). */
export function pickPattern(diff: number, r: Rng): Pattern {
  const w: [Pattern, number][] = [['scatter', 3]];
  if (diff >= 0.2) w.push(['corridor', 2]);
  if (diff >= 0.35) w.push(['gate', 2]);
  if (diff >= 0.5) w.push(['zigzag', 2]);
  let tot = 0;
  for (const e of w) tot += e[1];
  let x = r.next() * tot;
  for (const e of w) { x -= e[1]; if (x < 0) return e[0]; }
  return 'scatter';
}

function slot(s: Seg): Obs | null {
  if (s.nObs >= MAX_OBS) return null;
  const o = s.obs[s.nObs++];
  o.active = true; o.grazed = false; o.vx = 0; o.vy = 0; o.amp = 0; o.w = 0; o.ph = 0;
  return o;
}

function acacia(s: Seg, x: number, top: boolean, tip: number, dx = 0): void {
  const o = slot(s);
  if (!o) return;
  o.kind = K_ACACIA; o.r = 9;
  o.x1 = x; o.y1 = top ? CEIL : FLOOR;
  o.x2 = x + dx; o.y2 = tip;
}

function vbar(s: Seg, x: number, y1: number, y2: number): Obs | null {
  const o = slot(s);
  if (!o) return null;
  o.kind = K_LASER; o.r = 4;
  o.x1 = x; o.x2 = x; o.y1 = y1; o.y2 = y2; o.b1 = y1; o.b2 = y2;
  return o;
}

/** Retire les obstacles ajoutés depuis `from` qui gênent la trajectoire garantie ; un pattern est tout ou rien. */
function commit(s: Seg, from: number, all: boolean): void {
  let ok = true;
  for (let i = from; i < s.nObs; i++) if (!pathClear(s, s.obs[i])) ok = false;
  if (all && !ok) { for (let i = from; i < s.nObs; i++) s.obs[i].active = false; s.nObs = from; return; }
  let w = from;
  for (let i = from; i < s.nObs; i++) {
    if (pathClear(s, s.obs[i])) { if (w !== i) { const t = s.obs[w]; s.obs[w] = s.obs[i]; s.obs[i] = t; } w++; } else s.obs[i].active = false;
  }
  s.nObs = w;
}

function scatter(s: Seg, r: Rng, diff: number, ramp: boolean): void {
  const tries = 3 + Math.floor(diff * 6);
  const want = ramp ? 1 : 2 + Math.floor(diff * 4) + (r.chance(0.5) ? 1 : 0);
  for (let i = 0; i < tries && s.nObs < Math.min(want, MAX_OBS); i++) {
    const from = s.nObs;
    const cx = s.x0 + r.range(60, s.len - 40);
    if (r.chance(0.34)) {
      // branche d'acacia électrifiée, du plafond ou du sol
      const top = r.chance(0.5);
      const len = r.range(60, 170);
      acacia(s, cx, top, top ? CEIL + len : FLOOR - len, r.range(-24, 24));
    } else {
      // barre laser fixe : horizontale, verticale ou diagonale
      const o = slot(s);
      if (!o) break;
      o.kind = K_LASER; o.r = 4;
      const ang = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4][r.int(0, 3)];
      const half = r.range(26, 56);
      const cy = r.range(CEIL + 40, FLOOR - 40);
      o.x1 = cx - Math.cos(ang) * half; o.y1 = cy - Math.sin(ang) * half;
      o.x2 = cx + Math.cos(ang) * half; o.y2 = cy + Math.sin(ang) * half;
    }
    commit(s, from, false);
  }
}

/** Couloir : une acacia au plafond et une au sol, l'ouverture se resserre avec la difficulté. */
function corridor(s: Seg, r: Rng, diff: number): void {
  const x = s.x0 + r.range(110, 230);
  const half = 96 - diff * 26;
  const c = pathY(s, x);
  const from = s.nObs;
  acacia(s, x, true, c - half - 9);
  acacia(s, x + r.range(-12, 12), false, c + half + 9);
  commit(s, from, true);
}

/** Zigzag : des acacias alternées, haut / bas, dont les pointes frôlent la trajectoire. */
function zigzag(s: Seg, r: Rng, diff: number): void {
  const n = 3 + (diff > 0.75 ? 1 : 0);
  const gap = 78 - diff * 14;
  const from = s.nObs;
  let top = r.chance(0.5);
  for (let k = 0; k < n; k++) {
    const x = s.x0 + 70 + k * gap;
    const c = pathY(s, x);
    acacia(s, x, top, top ? c - 70 : c + 42);
    top = !top;
  }
  commit(s, from, true);
}

/** Porte mobile : deux barres laser dont l'ouverture monte et descend ; la trajectoire reste dans l'ouverture. */
function gate(s: Seg, r: Rng, diff: number): void {
  const x = s.x0 + r.range(120, 230);
  const half = 92;
  const c = pathY(s, x);
  const amp = 14 + 26 * diff;
  const w = r.range(1.6, 2.6);
  const ph = r.range(0, 6.28);
  const from = s.nObs;
  const t = vbar(s, x, CEIL - 30, c - half);
  const b = vbar(s, x, c + half, FLOOR + 30);
  for (const o of [t, b]) if (o) { o.amp = amp; o.w = w; o.ph = ph; }
  // la trajectoire doit passer en toute position de la porte : on teste les deux extrêmes
  for (const sgn of [-1, 1]) {
    for (const o of [t, b]) if (o) { o.y1 = o.b1 + sgn * amp; o.y2 = o.b2 + sgn * amp; }
    for (let i = from; i < s.nObs; i++) if (!pathClear(s, s.obs[i])) { for (let j = from; j < s.nObs; j++) s.obs[j].active = false; s.nObs = from; return; }
  }
  for (const o of [t, b]) if (o) { o.y1 = o.b1; o.y2 = o.b2; }
}

function placeObs(s: Seg, r: Rng, diff: number, ramp: boolean): void {
  const p = ramp ? 'scatter' : pickPattern(diff, r);
  if (p === 'corridor') corridor(s, r, diff);
  else if (p === 'zigzag') zigzag(s, r, diff);
  else if (p === 'gate') gate(s, r, diff);
  scatter(s, r, p === 'scatter' ? diff : diff * 0.5, ramp);
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
  if (!o.calm) placeObs(s, r, o.diff, !!o.ramp);
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
