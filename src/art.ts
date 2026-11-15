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

interface Coat { base: string; kind: 'patch' | 'zebra' | 'dots' | 'harlequin' | 'night'; mark: string }
const COATS: Record<string, Coat> = {
  'coat-classic': { base: '#F5A524', kind: 'patch', mark: '#7A3E12' },
  'coat-zebra': { base: '#FFFFFF', kind: 'zebra', mark: '#16110F' },
  'coat-dots': { base: '#1F5FD0', kind: 'dots', mark: '#FFFFFF' },
  'coat-stars': { base: '#1B2A5A', kind: 'night', mark: '#FFF6E0' },
  'coat-harlequin': { base: '#FFD60A', kind: 'harlequin', mark: '#E8402A' },
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
  const co = COATS[lo.coat] ?? COATS['coat-classic'];
  const hx = headDX(p.vy);
  const hy = headDY(p.vy);
  const bend = Math.max(-8, Math.min(10, p.vy * 0.025));

  drawPack(c, lo.pack, p);
  // queue
  c.beginPath(); c.moveTo(-14, 2); c.quadraticCurveTo(-22, 2 + Math.sin(p.t * 9) * 2, -24, 8); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
  c.lineWidth = LW; ell(c, -24, 9, 2.6, 3, co.mark === '#FFFFFF' || co.mark === '#FFF6E0' ? INK : co.mark);
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
  if (co.kind === 'zebra') {
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
  drawHat(c, lo.hat, hx, hy, p.t * 6 * Math.PI * 2 * (p.speed / 14 / 32));
}

function drawPack(c: Ctx, id: string, p: Pose): void {
  c.save();
  c.translate(-17, -1);
  c.lineWidth = LW;
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
  if (p.thrusting && !p.dead) {
    const f = 7 + Math.sin(p.t * 60) * 2.5;
    poly(c, [-4, 12, 2, 12, -1, 12 + f * 1.6], '#ffc43d');
    poly(c, [-2.5, 12, 0.5, 12, -1, 12 + f], '#ff5a3c', false);
  }
  c.restore();
}

function drawScarf(c: Ctx, id: string, nx: number, ny: number, p: Pose): void {
  const cols: Record<string, [string, string]> = {
    'scarf-stripes': ['#E8402A', '#FFF6E0'], 'scarf-aviator': ['#FFFFFF', '#FFFFFF'], 'scarf-knit': ['#1F5FD0', '#FFD60A'],
  };
  const [a, b] = cols[id] ?? cols['scarf-stripes'];
  // bande autour du cou
  c.save(); c.translate(nx, ny);
  c.beginPath(); c.ellipse(0, 0, 6.5, 3.6, -0.3, 0, 6.3); c.fillStyle = a; c.fill(); c.stroke();
  // pan flottant : la longueur et l'angle suivent la vitesse
  const len = (14 + (p.speed - 220) * 0.12 + 8) * (id === 'scarf-aviator' ? 1.5 : id === 'scarf-knit' ? 1.2 : 1);
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const u = i / segs;
    const x = -4 - u * len;
    const y = 1 + Math.sin(p.t * 10 - u * 4) * (1.5 + u * 3) - u * (p.vy * 0.01);
    const w = 5.5 - u * 1.5;
    c.fillStyle = i % 2 ? b : a;
    c.fillRect(x - len / segs, y - w / 2, len / segs + 0.8, w);
    if (id === 'scarf-knit') { c.fillStyle = b; c.fillRect(x - len / segs, y - 0.4, len / segs, 1); }
    if (id === 'scarf-aviator' && i === segs - 1) { c.strokeStyle = INK; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x - len / segs, y - 2 + k * 2); c.lineTo(x - len / segs - 2.5, y - 2.5 + k * 2); c.stroke(); } }
  }
  if (id === 'scarf-knit') { c.fillStyle = '#FFF6E0'; for (const dy of [-1.5, 1.5]) { c.beginPath(); c.arc(-4 - len - 1, 1 + dy, 1.6, 0, 6.3); c.fill(); c.stroke(); } }
  c.restore();
}

function drawHat(c: Ctx, id: string, hx: number, hy: number, propAngle: number): void {
  c.save();
  c.translate(hx, hy);
  c.lineWidth = LW;
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
    case 'head-propeller': {
      c.beginPath(); c.arc(0, -3, 9, Math.PI, 0); c.closePath(); c.fillStyle = '#FFD60A'; c.fill(); c.stroke();
      c.beginPath(); c.arc(0, -3, 9, Math.PI * 1.5, 0); c.lineTo(0, -3); c.closePath(); c.fillStyle = '#1F5FD0'; c.fill(); c.stroke();
      rect(c, -0.8, -15, 1.6, 4, INK, false);
      c.save(); c.translate(0, -15.5); c.rotate(propAngle); ell(c, -4.5, 0, 4.5, 1.3, '#E8402A'); ell(c, 4.5, 0, 4.5, 1.3, '#E8402A'); c.restore(); break;
    }
    case 'head-crown':
      poly(c, [-8, -7, -9, -17, -4, -12, 0, -19, 4, -12, 9, -17, 8, -7], '#FFC21A'); for (const gx of [-5, 0, 5]) ell(c, gx, -9.5, 1.5, 1.5, '#E5322D', false); break;
  }
  c.restore();
}

/** Forme d'une particule de traînée, centrée en (x, y), taille s. `k` : variation 0 à 1. */
export function drawTrailShape(c: Ctx, id: string, x: number, y: number, s: number, k: number): void {
  c.lineWidth = 1.6;
  c.strokeStyle = INK;
  switch (id) {
    case 'trail-hearts': heart(c, x, y, s * 0.55, '#E5322D'); break;
    case 'trail-stars': star(c, x, y, s * 0.65, '#FFD60A', true); break;
    default: c.beginPath(); c.arc(x, y, s * 0.45, 0, 6.3); c.fillStyle = '#C9CED6'; c.fill(); c.stroke();
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
  const zoom = slot === 'coat' ? 1.0 : slot === 'hat' ? 2.4 : slot === 'scarf' ? 2.0 : 1.9;
  const focus: Record<string, [number, number]> = { coat: [-1, -13], hat: [9, -33], scarf: [-2, -14], pack: [-8, -2] };
  const [fx, fy] = focus[slot];
  c.translate(w / 2 - fx * (h / 40) * (zoom / 1.5), h / 2 - fy * (h / 40) * (zoom / 1.5));
  const sc = (h / 40) * (zoom / 1.5);
  c.scale(sc, sc);
  drawGigi(c, lo, pose);
  c.restore();
}
