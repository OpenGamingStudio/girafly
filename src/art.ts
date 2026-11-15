// Dessin de Gigi et de ses cosmétiques : Canvas 2D fait maison (formes pleines, contour encre, aucun dégradé).
import { Slot } from './catalog';
import { headDX, headDY } from './geom';

export const INK = '#16110F';
const LW = 2.2;

type Ctx = CanvasRenderingContext2D;
export type Loadout = Record<Slot, string>;

function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke = true, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) c.stroke();
}
function poly(c: Ctx, pts: number[], fill: string, stroke = true, close = true): void {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  if (close) c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) c.stroke();
}
function rect(c: Ctx, x: number, y: number, w: number, h: number, fill: string, stroke = true): void {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
  if (stroke) c.strokeRect(x, y, w, h);
}
export function star(c: Ctx, x: number, y: number, r: number, fill: string, stroke = false): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) c.stroke();
}
export function heart(c: Ctx, x: number, y: number, r: number, fill: string): void {
  c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.5, y - r * 0.2, x - r * 0.7, y - r * 1.1, x, y - r * 0.35);
  c.bezierCurveTo(x + r * 0.7, y - r * 1.1, x + r * 1.5, y - r * 0.2, x, y + r * 0.9);
  c.fillStyle = fill;
  c.fill();
}

interface Coat { base: string; kind: 'patch' | 'zebra' | 'dots' | 'harlequin' | 'night'; mark: string; tail: string }
const COATS: Record<string, Coat> = {
  'coat-classic': { base: '#F5A524', kind: 'patch', mark: '#7A3E12', tail: '#7A3E12' },
  'coat-zebra': { base: '#FFFFFF', kind: 'zebra', mark: '#16110F', tail: '#16110F' },
  'coat-dots': { base: '#1F5FD0', kind: 'dots', mark: '#FFFFFF', tail: INK },
  'coat-stars': { base: '#1B2A5A', kind: 'night', mark: '#FFF6E0', tail: INK },
  'coat-harlequin': { base: '#FFD60A', kind: 'harlequin', mark: '#E8402A', tail: '#E8402A' },
};
export const coatBase = (id: string) => (COATS[id] ?? COATS['coat-classic']).base;

const BODY_MARKS = [-9, -2, -1, 6, 6, -3, -8, 7, 4, 8, -13, 3];

function mark(c: Ctx, co: Coat, x: number, y: number, k: number, ang: number): void {
  c.fillStyle = co.mark;
  switch (co.kind) {
    case 'patch':
      c.beginPath(); c.ellipse(x, y, 3.6, 3, ang, 0, 6.3); c.fill(); break;
    case 'zebra':
      c.save(); c.translate(x, y); c.rotate(ang);
      c.fillRect(-1.4, -6, 2.8, 12); c.restore(); break;
    case 'dots':
      c.beginPath(); c.arc(x, y, 2.6, 0, 6.3); c.fill(); break;
    case 'harlequin':
      c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-2.4, -2.4, 4.8, 4.8); c.restore(); break;
    case 'night':
      star(c, x, y, 3.2, co.mark); break;
  }
}

export interface Pose {
  vy: number;
  t: number;
  speed: number;
  thrusting: boolean;
  dead?: boolean;
  /** Mouvement réduit : hélice, écharpe et queue immobiles. */
  calm?: boolean;
  /** Expression : 0 normale, 1 contente, 2 peur, 3 sonnée. */
  mood?: number;
  /** Paupière baissée (clignement). */
  blink?: boolean;
}

// ---------- Bitmaps : chaque cosmétique est dessiné UNE fois dans un canvas hors écran ----------
// Ensuite drawGigi / drawTrailShape ne font que des drawImage et des tracés de nombres : aucun objet,
// tableau ni chaîne n'est créé par image. SC = pixels de bitmap par unité de scène (net jusqu'à ~4 px/unité).
const SC = 4;
type Spr = { cv: HTMLCanvasElement; x: number; y: number; w: number; h: number } | null;
let makeCanvas: () => HTMLCanvasElement = () => document.createElement('canvas');
export const bakeStats = { count: 0 };
const caches: Map<string, Spr>[] = [];
const cacheOf = (): Map<string, Spr> => { const m = new Map<string, Spr>(); caches.push(m); return m; };
const BODY = cacheOf(), HEAD = cacheOf(), STAMP = cacheOf(), PACK = cacheOf(), HAT = cacheOf(), BAND = cacheOf(), PAN = cacheOf(), TRAIL = cacheOf();
let FLAME: Spr | undefined;
let BLADES: Spr | undefined;

/** Pour les tests : fournit un canvas de remplacement et vide tous les bitmaps. */
export function setCanvasFactory(f: () => HTMLCanvasElement): void {
  makeCanvas = f;
  for (const m of caches) m.clear();
  FLAME = BLADES = undefined;
  bakeStats.count = 0;
}

function bake(minX: number, minY: number, w: number, h: number, fn: (c: Ctx) => void): Spr {
  const cv = makeCanvas();
  cv.width = Math.ceil(w * SC);
  cv.height = Math.ceil(h * SC);
  const c = cv.getContext('2d') as Ctx;
  c.scale(SC, SC);
  c.translate(-minX, -minY);
  c.lineWidth = LW; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
  fn(c);
  bakeStats.count++;
  return { cv, x: minX, y: minY, w, h };
}
const put = (c: Ctx, s: Spr): void => { if (s) c.drawImage(s.cv, s.x, s.y, s.w, s.h); };
const coatOf = (id: string): Coat => COATS[id] ?? COATS['coat-classic'];

function bodyOf(id: string): Spr {
  let s = BODY.get(id);
  if (s === undefined) {
    const co = coatOf(id);
    s = bake(-20, -10, 38, 28, (c) => {
      ell(c, -1, 3, 15, 11, co.base);
      c.save();
      c.beginPath(); c.ellipse(-1, 3, 14, 10, 0, 0, 6.3); c.clip();
      if (co.kind === 'zebra') for (let i = 0; i < 6; i++) mark(c, co, -12 + i * 4.5, 3, i, 0.25);
      else for (let i = 0; i < BODY_MARKS.length; i += 2) mark(c, co, BODY_MARKS[i], BODY_MARKS[i + 1] + 2, i / 2, 0.3);
      c.restore();
      ell(c, -1, 3, 15, 11, 'rgba(0,0,0,0)');
    });
    BODY.set(id, s);
  }
  return s;
}
function headOf(id: string): Spr {
  let s = HEAD.get(id);
  if (s === undefined) {
    const co = coatOf(id);
    s = bake(-14, -19, 31, 30, (c) => {
      ell(c, 6, 3, 8.5, 5.8, co.base);
      ell(c, 0, 0, 9.5, 8.2, co.base);
      ell(c, 12, 4, 1.1, 1.4, INK, false);
      c.beginPath(); c.moveTo(-3, -7); c.lineTo(-4, -13); c.moveTo(3, -7); c.lineTo(4, -13); c.stroke();
      ell(c, -4, -14, 2, 2, INK, false); ell(c, 4, -14, 2, 2, INK, false);
    });
    HEAD.set(id, s);
  }
  return s;
}
const NECK_ANG = Math.atan2(-1, 0.2);
function stampOf(id: string): Spr {
  let s = STAMP.get(id);
  if (s === undefined) {
    const co = coatOf(id);
    s = bake(-8, -8, 16, 16, (c) => mark(c, co, 0, 0, 0, NECK_ANG));
    STAMP.set(id, s);
  }
  return s;
}
function packOf(id: string): Spr {
  let s = PACK.get(id);
  if (s === undefined) {
    s = bake(-14, -12, 28, 24, (c) => drawPack(c, id));
    PACK.set(id, s);
  }
  return s;
}
function flame(): Spr {
  if (FLAME === undefined) {
    FLAME = bake(-7, 11, 12, 16, (c) => {
      poly(c, [-5, 12, 3, 12, 1, 12 + 6, -1, 12 + 7 * 1.9, -3, 12 + 6], '#ff5a3c');
      poly(c, [-3.4, 12, 1.4, 12, -1, 12 + 7 * 1.3], '#ffc43d', false);
      poly(c, [-1.9, 12, 0, 12, -0.9, 12 + 7 * 0.6], '#ffffff', false);
    });
  }
  return FLAME;
}
const HATS = ['head-goggles', 'head-cap', 'head-beanie', 'head-propeller', 'head-crown'];
function hatOf(id: string): Spr {
  let s = HAT.get(id);
  if (s === undefined) {
    s = HATS.includes(id) ? bake(-17, -21, 29, 26, (c) => drawHat(c, id)) : null;
    HAT.set(id, s);
  }
  return s;
}
function blades(): Spr {
  if (BLADES === undefined) BLADES = bake(-10, -3, 20, 6, (c) => { ell(c, -4.5, 0, 4.5, 1.3, '#E8402A'); ell(c, 4.5, 0, 4.5, 1.3, '#E8402A'); });
  return BLADES;
}
const SCARVES: Record<string, [string, string]> = {
  'scarf-stripes': ['#E8402A', '#FFF6E0'], 'scarf-aviator': ['#FFFFFF', '#FFFFFF'], 'scarf-knit': ['#1F5FD0', '#FFD60A'],
};
const scarfCols = (id: string): [string, string] => SCARVES[id] ?? SCARVES['scarf-stripes'];
const PAN_LEN_REF = 26.8; // longueur du pan à 260 de vitesse de scène
const panLen = (id: string): number => PAN_LEN_REF * (id === 'scarf-aviator' ? 1.5 : id === 'scarf-knit' ? 1.2 : 1);
function bandOf(id: string): Spr {
  let s = BAND.get(id);
  if (s === undefined) {
    const a = scarfCols(id)[0];
    s = bake(-8, -6, 16, 12, (c) => { c.beginPath(); c.ellipse(0, 0, 6.5, 3.6, -0.3, 0, 6.3); c.fillStyle = a; c.fill(); c.stroke(); });
    BAND.set(id, s);
  }
  return s;
}
function panOf(id: string): Spr {
  let s = PAN.get(id);
  if (s === undefined) {
    const len = panLen(id);
    s = bake(-4 - len - 8, -6, len + 10, 12, (c) => drawPan(c, id, len));
    PAN.set(id, s);
  }
  return s;
}

/** Œil et bouche selon l'expression (tracés simples, aucune allocation). */
function face(c: Ctx, hx: number, hy: number, p: Pose, mood: number): void {
  const ex = hx + 3.5, ey = hy - 1.5;
  if (p.dead) {
    c.beginPath(); c.moveTo(hx + 1, hy - 4); c.lineTo(hx + 6, hy + 1); c.moveTo(hx + 6, hy - 4); c.lineTo(hx + 1, hy + 1); c.stroke();
    return;
  }
  if (mood === 3) {
    // sonnée : spirale (arc), bouche ondulée
    c.beginPath(); c.arc(ex, ey, 3.2, 0.5, 5.2); c.stroke(); c.beginPath(); c.arc(ex, ey, 1.2, 3, 8); c.stroke();
    c.beginPath(); c.moveTo(hx + 5, hy + 6.4); c.lineTo(hx + 7, hy + 5.4); c.lineTo(hx + 9, hy + 6.4); c.lineTo(hx + 11, hy + 5.4); c.stroke();
    return;
  }
  if (p.blink) { c.beginPath(); c.moveTo(ex - 2.6, ey + 0.6); c.lineTo(ex + 2.6, ey + 0.6); c.stroke(); }
  else if (mood === 1) { c.beginPath(); c.arc(ex, ey + 1.4, 2.6, 3.6, 5.8); c.stroke(); }
  else if (mood === 2) { ell(c, ex, ey, 3.2, 3.6, '#ffffff', true); ell(c, ex + 0.4, ey, 1, 1.2, INK, false); }
  else { ell(c, ex, ey, 2.4, 2.7, '#ffffff', false); ell(c, ex + 0.7, ey + 0.3, 1.3, 1.6, INK, false); }
  if (mood === 2) {
    // sourcil relevé, bouche ouverte
    c.beginPath(); c.moveTo(ex - 3, ey - 5.2); c.lineTo(ex + 3, ey - 3.6); c.stroke();
    ell(c, hx + 8, hy + 6.4, 1.6, 2, INK, false);
  } else if (mood === 1) {
    c.beginPath(); c.arc(hx + 8, hy + 4.8, 3, 0.25, 2.2); c.stroke();
  } else {
    c.beginPath(); c.moveTo(hx + 6, hy + 6.6); c.lineTo(hx + 10.5, hy + 6.2); c.stroke();
  }
}

// Cou : points calculés dans des variables de module (pas de tableau par image).
let NX = 0, NY = 0;
function neckPoint(hx: number, hy: number, bend: number, u: number): void {
  // courbe quadratique du haut du corps (4,-4) à la base de la tête
  const x0 = 4, y0 = -4, cx = 5 - bend, cy = -17, x1 = hx - 1, y1 = hy + 8;
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
  NX = a * x0 + b * cx + d * x1;
  NY = a * y0 + b * cy + d * y1;
}

/** Gigi à l'origine du contexte. Hitbox = corps + tête ; le cou se plie selon la vitesse verticale. */
export function drawGigi(c: Ctx, lo: Loadout, p: Pose): void {
  c.lineWidth = LW;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = INK;
  const co = coatOf(lo.coat);
  const hx = headDX(p.vy);
  const hy = headDY(p.vy);
  const mood = p.mood ?? 0;
  const bend = Math.max(-8, Math.min(10, p.vy * 0.025)) + (p.calm ? 0 : Math.sin(p.t * 2.4) * 1.2 + (mood === 2 ? Math.sin(p.t * 40) * 0.6 : 0));
  const wave = p.calm ? 0 : p.t;

  // jetpack (bitmap) et sa flamme (bitmap étiré)
  c.save();
  c.translate(-17, -1);
  put(c, packOf(lo.pack));
  rect(c, -4.5, 9, 7, 4, '#5c5568');
  if (p.thrusting && !p.dead) {
    // flamme animée : longueur et largeur vacillent à des rythmes différents
    const f = 7 + Math.sin(wave * 60) * 2.5 + Math.sin(wave * 37) * 1.5;
    c.translate(-1, 12); c.scale(1 + Math.sin(wave * 45) * 0.12, f / 7); c.translate(1, -12);
    put(c, flame());
  }
  c.restore();
  // queue
  c.beginPath(); c.moveTo(-14, 2); c.quadraticCurveTo(-22, 2 + Math.sin(wave * 9) * 2, -24, 8); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
  c.lineWidth = LW; ell(c, -24, 9, 2.6, 3, co.tail);
  // pattes
  const sw = p.thrusting ? 0.4 : 1;
  rect(c, -9, 10, 5, 8 + sw, co.base);
  rect(c, 3, 10, 5, 7 + sw * 0.5, co.base);
  // cou : contour puis remplissage
  c.beginPath();
  c.moveTo(4, -4); c.quadraticCurveTo(5 - bend, -17, hx - 1, hy + 8);
  c.lineWidth = 12.5; c.strokeStyle = INK; c.stroke();
  c.lineWidth = 8.5; c.strokeStyle = co.base; c.stroke();
  c.lineWidth = LW; c.strokeStyle = INK;
  // marques du cou (bitmap tamponné)
  const st = stampOf(lo.coat);
  for (let i = 0; i < 4; i++) {
    neckPoint(hx, hy, bend, 0.2 + i * 0.2);
    c.save(); c.translate(NX, NY); put(c, st); c.restore();
  }
  put(c, bodyOf(lo.coat));
  // écharpe : bande, puis pan qui ondule (bitmap tourné et étiré selon la vitesse)
  neckPoint(hx, hy, bend, 0.5);
  c.save();
  c.translate(NX, NY);
  put(c, bandOf(lo.scarf));
  const len0 = panLen(lo.scarf);
  const k = (14 + (p.speed - 220) * 0.12 + 8) * (len0 / PAN_LEN_REF) / len0;
  c.translate(-4, 1);
  c.rotate(Math.sin(wave * 10) * 0.14 - p.vy * 0.0004);
  c.scale(k, 1);
  c.translate(4, -1);
  put(c, panOf(lo.scarf));
  c.restore();
  // tête (bitmap) puis œil
  c.save(); c.translate(hx, hy);
  put(c, headOf(lo.coat));
  c.restore();
  // oreille : bat doucement, se couche en arrière quand Gigi a peur, se dresse quand elle est contente
  ell(c, hx - 8, hy - 1, 3.4, 2, co.base, true, mood === 2 ? -1.1 : mood === 1 ? -0.1 : -0.5 + Math.sin(wave * 7) * 0.22);
  face(c, hx, hy, p, mood);
  // coiffe (bitmap) ; l'hélice tourne sauf en mouvement réduit
  c.save(); c.translate(hx, hy);
  put(c, hatOf(lo.hat));
  if (lo.hat === 'head-propeller') {
    c.translate(0, -15.5);
    c.rotate(p.calm ? 0 : p.t * 6 * Math.PI * 2 * (p.speed / 14 / 32));
    put(c, blades());
  }
  c.restore();
}

function drawPack(c: Ctx, id: string): void {
  switch (id) {
    case 'pack-milk':
      for (const dy of [-5, 4]) { rect(c, -7, dy - 4, 12, 9, '#ffffff'); rect(c, -8, dy - 5, 3, 11, '#1F5FD0'); ell(c, 0, dy, 2, 2, '#1F5FD0', false); }
      break;
    case 'pack-soda':
      for (const dy of [-5, 4]) { poly(c, [-8, dy - 3, 2, dy - 3, 4, dy - 1, 8, dy - 1, 8, dy + 1, 4, dy + 1, 2, dy + 3, -8, dy + 3], '#2E9E4A'); rect(c, -5, dy - 2, 5, 4, '#FFD60A', false); }
      break;
    case 'pack-teapot':
      ell(c, -1, 0, 8, 7, '#FFF6E0'); poly(c, [6, -2, 12, -6, 12, -4, 8, 1], '#FFF6E0'); rect(c, -4, -9, 6, 3, '#FFF6E0');
      c.fillStyle = '#E8402A'; for (const [dx, dy] of [[-4, -1], [1, 2], [0, -3]]) { c.beginPath(); c.arc(dx, dy, 1.3, 0, 6.3); c.fill(); }
      break;
    default:
      for (const dy of [-5, 4]) { poly(c, [-9, dy - 4, 4, dy - 4, 9, dy, 4, dy + 4, -9, dy + 4], '#C9CED6'); rect(c, -9, dy - 2, 3, 4, '#E5322D', false); }
  }
}

/** Pan de l'écharpe, droit, à la longueur de référence (l'ondulation est faite à l'affichage). */
function drawPan(c: Ctx, id: string, len: number): void {
  const [a, b] = scarfCols(id);
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const u = i / segs;
    const x = -4 - u * len;
    const y = 1;
    const w = 5.5 - u * 1.5;
    c.fillStyle = i % 2 ? b : a;
    c.fillRect(x - len / segs, y - w / 2, len / segs + 0.8, w);
    if (id === 'scarf-knit') { c.fillStyle = b; c.fillRect(x - len / segs, y - 0.4, len / segs, 1); }
    if (id === 'scarf-aviator' && i === segs - 1) { c.strokeStyle = INK; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x - len / segs, y - 2 + k * 2); c.lineTo(x - len / segs - 2.5, y - 2.5 + k * 2); c.stroke(); } }
  }
  if (id === 'scarf-knit') { c.fillStyle = '#FFF6E0'; for (const dy of [-1.5, 1.5]) { c.beginPath(); c.arc(-4 - len - 1, 1 + dy, 1.6, 0, 6.3); c.fill(); c.stroke(); } }
}

/** Coiffe à l'origine de la tête (l'hélice est un bitmap à part, tourné à l'affichage). */
function drawHat(c: Ctx, id: string): void {
  switch (id) {
    case 'head-goggles':
      ell(c, 3.5, -1.5, 3.8, 3.8, '#8FD3FF'); ell(c, -3.5, -1.5, 3.2, 3.2, '#8FD3FF');
      c.strokeStyle = '#7A3E12'; c.beginPath(); c.moveTo(-6.7, -2); c.lineTo(-10, -4); c.stroke(); c.strokeStyle = INK; break;
    case 'head-cap':
      c.save(); c.rotate(-0.17);
      c.beginPath(); c.arc(0, -3, 9, Math.PI, 0); c.closePath(); c.fillStyle = '#E8402A'; c.fill(); c.stroke();
      poly(c, [-2, -4, -15, -3, -15, -1, -2, -1], '#16110F'); c.restore(); break;
    case 'head-beanie':
      poly(c, [-9, -3, -7, -11, 0, -15, 7, -11, 9, -3], '#2E9E4A'); rect(c, -9.5, -5, 19, 3.5, '#2E9E4A');
      c.beginPath(); for (const dx of [-5, 0, 5]) { c.moveTo(dx, -5); c.lineTo(dx, -1.5); } c.stroke();
      ell(c, 0, -16, 3, 3, '#FFF6E0'); break;
    case 'head-propeller':
      c.beginPath(); c.arc(0, -3, 9, Math.PI, 0); c.closePath(); c.fillStyle = '#FFD60A'; c.fill(); c.stroke();
      c.beginPath(); c.arc(0, -3, 9, Math.PI * 1.5, 0); c.lineTo(0, -3); c.closePath(); c.fillStyle = '#1F5FD0'; c.fill(); c.stroke();
      rect(c, -0.8, -15, 1.6, 4, INK, false);
      break;
    case 'head-crown':
      poly(c, [-8, -7, -9, -17, -4, -12, 0, -19, 4, -12, 9, -17, 8, -7], '#FFC21A'); for (const gx of [-5, 0, 5]) ell(c, gx, -9.5, 1.5, 1.5, '#E5322D', false); break;
  }
}

/** Forme d'une particule de traînée (bitmap), centrée en (x, y), taille s. */
export function drawTrailShape(c: Ctx, id: string, x: number, y: number, s: number, _k: number): void {
  let b = TRAIL.get(id);
  if (b === undefined) {
    b = bake(-9, -9, 18, 18, (cc) => {
      cc.lineWidth = 1.6;
      switch (id) {
        case 'trail-hearts': heart(cc, 0, 0, 5.5, '#E5322D'); break;
        case 'trail-stars': star(cc, 0, 0, 6.5, '#FFD60A', true); break;
        default: cc.beginPath(); cc.arc(0, 0, 4.5, 0, 6.3); cc.fillStyle = '#C9CED6'; cc.fill(); cc.stroke();
      }
    });
    TRAIL.set(id, b);
  }
  if (b) c.drawImage(b.cv, x - s * 0.9, y - s * 0.9, s * 1.8, s * 1.8);
}

/** Vignette d'un cosmétique (boutique) : cadrage selon l'emplacement. */
export function drawThumb(c: Ctx, itemId: string, slot: Slot, base: Loadout, w: number, h: number): void {
  const lo: Loadout = { ...base, [slot]: itemId };
  c.save();
  c.clearRect(0, 0, w, h);
  if (slot === 'trail') {
    const n = [0.2, 0.5, 0.8];
    n.forEach((u, i) => drawTrailShape(c, itemId, w * (0.2 + u * 0.6), h * (0.35 + (i % 2) * 0.3), h * 0.45, u));
    c.restore();
    return;
  }
  const pose: Pose = { vy: 0, t: 0.4, speed: 260, thrusting: false };
  const zoom = slot === 'coat' ? 1.0 : slot === 'hat' ? 2.4 : slot === 'scarf' ? 2.0 : 1.9;
  const focus: Record<string, [number, number]> = { coat: [-1, -13], hat: [9, -33], scarf: [-2, -14], pack: [-8, -2] };
  const [fx, fy] = focus[slot];
  c.translate(w / 2 - fx * (h / 40) * (zoom / 1.5), h / 2 - fy * (h / 40) * (zoom / 1.5));
  const sc = (h / 40) * (zoom / 1.5);
  c.scale(sc, sc);
  drawGigi(c, lo, pose);
  c.restore();
}
