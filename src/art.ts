// Dessin de Gigi et de ses cosmétiques : Canvas 2D fait maison (formes pleines, contour encre, aucun dégradé).
import { Slot } from './catalog';
import { headDX, headDY } from './geom';

export const INK = '#1f1a2e';
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

interface Coat { base: string; kind: 'patch' | 'zebra' | 'leopard' | 'dots' | 'cow' | 'tiger' | 'rainbow' | 'night'; mark: string; alt?: string }
const COATS: Record<string, Coat> = {
  'coat-classique': { base: '#ffc43d', kind: 'patch', mark: '#b5651d' },
  'coat-zebre': { base: '#ffffff', kind: 'zebra', mark: '#1f1a2e' },
  'coat-leopard': { base: '#ffb02e', kind: 'leopard', mark: '#8a3b12' },
  'coat-pois': { base: '#3fd0c9', kind: 'dots', mark: '#ffffff' },
  'coat-vache': { base: '#ffffff', kind: 'cow', mark: '#1f1a2e' },
  'coat-tigre': { base: '#ff8a1f', kind: 'tiger', mark: '#1f1a2e' },
  'coat-arcenciel': { base: '#ff5a5f', kind: 'rainbow', mark: '#ffc43d', alt: '#3fd0c9' },
  'coat-nuit': { base: '#2b2f77', kind: 'night', mark: '#ffe066' },
};
export const coatBase = (id: string) => (COATS[id] ?? COATS['coat-classique']).base;

const BODY_MARKS = [-9, -2, -1, 6, 6, -3, -8, 7, 4, 8, -13, 3];
const RAINBOW = ['#ff5a5f', '#ffa62b', '#ffe066', '#3fd0c9', '#5b7cfa'];

function mark(c: Ctx, co: Coat, x: number, y: number, k: number, ang: number): void {
  c.fillStyle = co.mark;
  switch (co.kind) {
    case 'patch':
      c.beginPath(); c.ellipse(x, y, 3.6, 3, ang, 0, 6.3); c.fill(); break;
    case 'zebra':
    case 'tiger':
      c.save(); c.translate(x, y); c.rotate(ang);
      c.fillRect(-1.4, -6, 2.8, 12); c.restore(); break;
    case 'leopard':
      c.beginPath(); c.arc(x, y, 3.2, 0, 6.3); c.lineWidth = 1.8; c.strokeStyle = co.mark; c.stroke(); c.lineWidth = LW; c.strokeStyle = INK; break;
    case 'dots':
      c.beginPath(); c.arc(x, y, 2.6, 0, 6.3); c.fill(); break;
    case 'cow':
      if (k % 2 === 0) { c.beginPath(); c.ellipse(x, y, 4.6, 3.2, ang + k, 0, 6.3); c.fill(); } break;
    case 'rainbow':
      c.fillStyle = RAINBOW[k % 5]; c.beginPath(); c.arc(x, y, 3, 0, 6.3); c.fill(); break;
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
}

function neckPoint(hx: number, hy: number, bend: number, u: number): [number, number] {
  // courbe quadratique du haut du corps (4,-4) à la base de la tête
  const x0 = 4, y0 = -4, cx = 5 - bend, cy = -17, x1 = hx - 1, y1 = hy + 8;
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
  return [a * x0 + b * cx + d * x1, a * y0 + b * cy + d * y1];
}

/** Gigi à l'origine du contexte. Hitbox = corps + tête ; le cou se plie selon la vitesse verticale. */
export function drawGigi(c: Ctx, lo: Loadout, p: Pose): void {
  c.lineWidth = LW;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = INK;
  const co = COATS[lo.coat] ?? COATS['coat-classique'];
  const hx = headDX(p.vy);
  const hy = headDY(p.vy);
  const bend = Math.max(-8, Math.min(10, p.vy * 0.025));

  drawPack(c, lo.pack, p);
  // queue
  c.beginPath(); c.moveTo(-14, 2); c.quadraticCurveTo(-22, 2 + Math.sin(p.t * 9) * 2, -24, 8); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
  c.lineWidth = LW; ell(c, -24, 9, 2.6, 3, co.mark === '#ffffff' ? '#1f1a2e' : co.mark === '#1f1a2e' ? '#1f1a2e' : '#b5651d');
  // pattes
  const sw = p.thrusting ? 0.4 : 1;
  rect(c, -9, 10, 5, 8 + sw, co.base);
  rect(c, 3, 10, 5, 7 + sw * 0.5, co.base);
  // cou : contour puis remplissage
  c.beginPath();
  const [mx, my] = neckPoint(hx, hy, bend, 0.5);
  c.moveTo(4, -4); c.quadraticCurveTo(5 - bend, -17, hx - 1, hy + 8);
  c.lineWidth = 12.5; c.strokeStyle = INK; c.stroke();
  c.lineWidth = 8.5; c.strokeStyle = co.base; c.stroke();
  c.lineWidth = LW; c.strokeStyle = INK;
  // marques du cou
  for (let i = 0; i < 4; i++) {
    const u = 0.2 + i * 0.2;
    const [nx, ny] = neckPoint(hx, hy, bend, u);
    mark(c, co, nx, ny, i + 1, Math.atan2(-1, 0.2) );
  }
  // corps
  ell(c, -1, 3, 15, 11, co.base);
  c.save();
  c.beginPath(); c.ellipse(-1, 3, 14, 10, 0, 0, 6.3); c.clip();
  if (co.kind === 'rainbow') {
    for (let i = 0; i < 5; i++) { c.fillStyle = RAINBOW[i]; c.fillRect(-16, -8 + i * 4.6, 32, 4.7); }
  } else if (co.kind === 'zebra' || co.kind === 'tiger') {
    for (let i = 0; i < 6; i++) mark(c, co, -12 + i * 4.5, 3, i, 0.25);
  } else {
    for (let i = 0; i < BODY_MARKS.length; i += 2) mark(c, co, BODY_MARKS[i], BODY_MARKS[i + 1] + 2, i / 2, 0.3);
  }
  c.restore();
  ell(c, -1, 3, 15, 11, 'rgba(0,0,0,0)');
  // écharpe
  drawScarf(c, lo.scarf, mx, my, p);
  // tête
  ell(c, hx + 6, hy + 3, 8.5, 5.8, co.base);
  ell(c, hx, hy, 9.5, 8.2, co.base);
  ell(c, hx + 12, hy + 4, 1.1, 1.4, INK, false);
  // cornes (ossicônes) et oreille
  c.beginPath(); c.moveTo(hx - 3, hy - 7); c.lineTo(hx - 4, hy - 13); c.moveTo(hx + 3, hy - 7); c.lineTo(hx + 4, hy - 13); c.stroke();
  ell(c, hx - 4, hy - 14, 2, 2, INK, false); ell(c, hx + 4, hy - 14, 2, 2, INK, false);
  ell(c, hx - 8, hy - 1, 3.4, 2, co.base, true, -0.5);
  // œil (X si K.O.)
  if (p.dead) { c.beginPath(); c.moveTo(hx + 1, hy - 4); c.lineTo(hx + 6, hy + 1); c.moveTo(hx + 6, hy - 4); c.lineTo(hx + 1, hy + 1); c.stroke(); }
  else { ell(c, hx + 3.5, hy - 1.5, 2.4, 2.7, '#ffffff', false); ell(c, hx + 4.2, hy - 1.2, 1.3, 1.6, INK, false); }
  drawHat(c, lo.hat, hx, hy);
}

function drawPack(c: Ctx, id: string, p: Pose): void {
  c.save();
  c.translate(-17, -1);
  c.lineWidth = LW;
  switch (id) {
    case 'pack-lait':
      for (const dy of [-5, 4]) { rect(c, -7, dy - 4, 12, 9, '#ffffff'); rect(c, -8, dy - 5, 3, 11, '#5b7cfa'); ell(c, 0, dy, 2, 2, '#5b7cfa', false); }
      break;
    case 'pack-fusees':
      for (const dy of [-5, 4]) { poly(c, [-9, dy - 4, 4, dy - 4, 9, dy, 4, dy + 4, -9, dy + 4], '#ff5a3c'); rect(c, -9, dy - 2, 3, 4, '#ffe066', false); }
      break;
    case 'pack-soda':
      poly(c, [-8, -7, 4, -7, 8, -3, 8, 3, 4, 7, -8, 7], '#3fd0a0'); rect(c, -4, -3, 7, 6, '#ffffff', false); rect(c, 8, -2, 3, 4, '#ff5a3c');
      break;
    case 'pack-ventilo':
      rect(c, -8, -7, 9, 14, '#8fa3b8'); {
        c.save(); c.translate(3, 0); c.rotate(p.t * 28);
        for (let i = 0; i < 3; i++) { c.rotate((Math.PI * 2) / 3); ell(c, 0, 5, 2.4, 5.2, '#ff5a3c'); }
        c.restore(); ell(c, 3, 0, 1.8, 1.8, INK, false);
      }
      break;
    case 'pack-nuage':
      ell(c, -2, -4, 6, 5, '#ffffff'); ell(c, 4, 2, 6, 5, '#ffffff'); ell(c, -5, 3, 6, 5, '#ffffff'); ell(c, 0, 1, 5, 4, '#ffffff', false);
      break;
    default:
      rect(c, -8, -8, 14, 16, '#8fa3b8'); rect(c, -8, -4, 14, 3, '#5b6b80', false); rect(c, -4, 8, 6, 3, '#ff5a3c');
  }
  if (p.thrusting && !p.dead) {
    const f = 7 + Math.sin(p.t * 60) * 2.5;
    poly(c, [-4, 12, 2, 12, -1, 12 + f * 1.6], '#ffc43d');
    poly(c, [-2.5, 12, 0.5, 12, -1, 12 + f], '#ff5a3c', false);
  }
  c.restore();
}

function drawScarf(c: Ctx, id: string, nx: number, ny: number, p: Pose): void {
  if (id === 'scarf-none') return;
  const cols: Record<string, [string, string]> = {
    'scarf-rayee': ['#ff3d5a', '#ffffff'], 'scarf-tricot': ['#3b82f6', '#bfdbfe'],
    'scarf-pois': ['#ffd23f', '#ff5a3c'], 'scarf-flamme': ['#ff6b1a', '#ffd23f'],
  };
  const [a, b] = cols[id] ?? cols['scarf-rayee'];
  // bande autour du cou
  c.save(); c.translate(nx, ny);
  c.beginPath(); c.ellipse(0, 0, 6.5, 3.6, -0.3, 0, 6.3); c.fillStyle = a; c.fill(); c.stroke();
  // pan flottant : la longueur et l'angle suivent la vitesse
  const len = 14 + (p.speed - 220) * 0.12 + 8;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const u = i / segs;
    const x = -4 - u * len;
    const y = 1 + Math.sin(p.t * 10 - u * 4) * (1.5 + u * 3) - u * (p.vy * 0.01);
    const w = 5.5 - u * 1.5;
    c.fillStyle = i % 2 ? b : a;
    c.fillRect(x - len / segs, y - w / 2, len / segs + 0.8, w);
    if (id === 'scarf-pois' && i % 2) { c.fillStyle = a; c.beginPath(); c.arc(x - len / (2 * segs), y, 1, 0, 6.3); c.fill(); }
    if (id === 'scarf-tricot') { c.fillStyle = a; c.fillRect(x - 1, y - 0.5, 1.4, 1); }
  }
  c.restore();
}

function drawHat(c: Ctx, id: string, hx: number, hy: number): void {
  c.save();
  c.translate(hx, hy);
  c.lineWidth = LW;
  switch (id) {
    case 'hat-casquette':
      c.beginPath(); c.arc(0, -3, 9, Math.PI, 0); c.closePath(); c.fillStyle = '#ff3d5a'; c.fill(); c.stroke();
      poly(c, [2, -4, 15, -3, 15, -1, 2, -1], '#c81e3d'); break;
    case 'hat-bonnet':
      poly(c, [-9, -3, -7, -11, 0, -15, 7, -11, 9, -3], '#3b82f6'); rect(c, -9.5, -5, 19, 3.5, '#bfdbfe'); ell(c, 0, -16, 3, 3, '#ffffff'); break;
    case 'hat-lunettes':
      ell(c, 3.5, -1.5, 4.4, 4.4, 'rgba(255,255,255,0.0)'); ell(c, -4, -1.5, 3.6, 3.6, 'rgba(255,255,255,0)');
      c.fillStyle = '#1f1a2e'; c.fillRect(-1, -2, 1.2, 1.2); c.beginPath(); c.moveTo(-8, -2); c.lineTo(-10, -4); c.stroke(); break;
    case 'hat-cowboy':
      ell(c, 0, -8, 15, 3.6, '#9a5b25'); poly(c, [-6, -9, -5, -17, 5, -17, 6, -9], '#b9722f'); rect(c, -5.5, -12, 11, 2.4, '#1f1a2e', false); break;
    case 'hat-aviateur':
      c.beginPath(); c.arc(0, -1, 9.8, Math.PI * 0.95, Math.PI * 2.05); c.closePath(); c.fillStyle = '#8a5a2b'; c.fill(); c.stroke();
      ell(c, -2, -9, 3.2, 3.2, '#bfe9ff'); ell(c, 4, -9, 3.2, 3.2, '#bfe9ff'); break;
    case 'hat-hautdeforme':
      ell(c, 0, -8, 11, 2.6, '#1f1a2e'); rect(c, -6.5, -21, 13, 13, '#2d2640'); rect(c, -6.5, -12, 13, 3, '#ff3d5a', false); break;
    case 'hat-licorne':
      poly(c, [-3, -8, 3, -8, 0.5, -22], '#fff1f8'); c.beginPath(); c.moveTo(-2, -12); c.lineTo(2, -14); c.moveTo(-1.5, -16); c.lineTo(1.2, -18); c.stroke(); star(c, 6, -14, 2.4, '#ffd23f'); break;
    case 'hat-couronne':
      poly(c, [-8, -7, -9, -17, -4, -12, 0, -19, 4, -12, 9, -17, 8, -7], '#ffc43d'); ell(c, 0, -10, 1.6, 1.6, '#ff3d5a', false); break;
  }
  c.restore();
}

/** Forme d'une particule de traînée, centrée en (x, y), taille s. `k` : variation 0 à 1. */
export function drawTrailShape(c: Ctx, id: string, x: number, y: number, s: number, k: number): void {
  c.lineWidth = 1.6;
  c.strokeStyle = INK;
  switch (id) {
    case 'trail-coeurs': heart(c, x, y, s * 0.55, '#ff4d7e'); break;
    case 'trail-etoiles': star(c, x, y, s * 0.65, '#ffd23f', true); break;
    case 'trail-notes':
      c.fillStyle = '#6d4cff'; c.beginPath(); c.ellipse(x - s * 0.15, y + s * 0.25, s * 0.28, s * 0.2, -0.4, 0, 6.3); c.fill();
      c.beginPath(); c.moveTo(x + s * 0.1, y + s * 0.2); c.lineTo(x + s * 0.1, y - s * 0.5); c.lineTo(x + s * 0.4, y - s * 0.3); c.lineWidth = 2; c.stroke(); break;
    case 'trail-bulles': c.beginPath(); c.arc(x, y, s * 0.42, 0, 6.3); c.fillStyle = '#d7f1ff'; c.fill(); c.stroke(); c.beginPath(); c.arc(x - s * 0.14, y - s * 0.14, s * 0.1, 0, 6.3); c.fillStyle = '#ffffff'; c.fill(); break;
    case 'trail-confettis': c.save(); c.translate(x, y); c.rotate(k * 6); c.fillStyle = ['#ff3d5a', '#3fd0c9', '#ffd23f', '#6d4cff'][Math.floor(k * 4) % 4]; c.fillRect(-s * 0.3, -s * 0.15, s * 0.6, s * 0.3); c.restore(); break;
    default: c.beginPath(); c.arc(x, y, s * 0.45, 0, 6.3); c.fillStyle = '#e6e2ee'; c.fill(); c.stroke();
  }
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
  const zoom = slot === 'coat' ? 1.5 : slot === 'hat' ? 3.4 : slot === 'scarf' ? 2.6 : 2.8;
  const focus: Record<string, [number, number]> = { coat: [-1, -6], hat: [12, -30], scarf: [2, -16], pack: [-12, 2] };
  const [fx, fy] = focus[slot];
  c.translate(w / 2 - fx * (h / 40) * (zoom / 1.5), h / 2 - fy * (h / 40) * (zoom / 1.5));
  const sc = (h / 40) * (zoom / 1.5);
  c.scale(sc, sc);
  drawGigi(c, lo, pose);
  c.restore();
}
