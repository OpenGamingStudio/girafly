import { CEIL, EVENT_DUR, FLOOR, H, POOL } from './config';
import { INK, Loadout, drawGigi, drawTrailShape, star } from './art';
import { B_BALLOON, B_MAGNET, B_SHIELD } from './gen';
import { K_ACACIA, K_BEAM, K_LASER, K_METEOR, Obs } from './geom';
import { BEAM_WARN, E_DRONE, E_WIND, EVENT_NAMES, Game, METEOR_WARN, SWEEP_HALF } from './sim';

export interface View {
  w: number; // largeur logique
  reduce: boolean;
  shake: number; // 0 à 1
  flash: number; // 0 à 1 (supprimé si mouvement réduit)
}

const SKIES = [
  { sky: '#7fd4ff', far: '#9be3c0', mid: '#5cc48a', ground: '#f2c86b', ground2: '#d9a441', cloud: '#ffffff' },
  { sky: '#ffb36b', far: '#ff8a5c', mid: '#c4503a', ground: '#e8a25a', ground2: '#c47a35', cloud: '#ffe1c2' },
  { sky: '#5b5fc7', far: '#3a3f93', mid: '#272b6b', ground: '#b38a4a', ground2: '#8c6a34', cloud: '#a9acf0' },
];

const mod = (a: number, b: number) => ((a % b) + b) % b;

function acaciaTree(c: CanvasRenderingContext2D, x: number, base: number, s: number, col: string, trunk: string): void {
  c.fillStyle = trunk;
  c.fillRect(x - 2 * s, base - 30 * s, 4 * s, 30 * s);
  c.fillStyle = col;
  c.beginPath(); c.ellipse(x, base - 32 * s, 24 * s, 7 * s, 0, 0, 6.3); c.fill();
}

function background(c: CanvasRenderingContext2D, g: Game, v: View): void {
  const pal = SKIES[Math.floor(g.dist / 500) % SKIES.length];
  const par = v.reduce ? 0.35 : 1;
  c.fillStyle = pal.sky;
  c.fillRect(0, 0, v.w, H);
  const cam = g.camX * par;
  // nuages (plats)
  c.fillStyle = pal.cloud;
  for (let i = 0; i < 6; i++) {
    const x = mod(i * 190 - cam * 0.08, v.w + 200) - 100;
    const y = 50 + ((i * 53) % 90);
    c.beginPath(); c.ellipse(x, y, 34, 10, 0, 0, 6.3); c.ellipse(x + 18, y - 7, 20, 9, 0, 0, 6.3); c.fill();
  }
  // collines lointaines et arbres
  c.fillStyle = pal.far;
  for (let i = 0; i < 5; i++) {
    const x = mod(i * 260 - cam * 0.2, v.w + 400) - 200;
    c.beginPath(); c.ellipse(x, FLOOR, 170, 70 + (i % 3) * 14, 0, Math.PI, 0); c.fill();
  }
  for (let i = 0; i < 8; i++) {
    const x = mod(i * 170 - cam * 0.45, v.w + 200) - 100;
    acaciaTree(c, x, FLOOR, 1 + (i % 3) * 0.25, pal.mid, '#6b4a2a');
  }
  // sol (savane) et plafond (feuillage)
  c.fillStyle = pal.ground; c.fillRect(0, FLOOR, v.w, H - FLOOR);
  c.fillStyle = pal.ground2; c.fillRect(0, FLOOR, v.w, 5);
  c.fillStyle = INK; c.fillRect(0, FLOOR - 1, v.w, 2);
  for (let i = 0; i < 14; i++) {
    const x = mod(i * 64 - g.camX, v.w + 128) - 64;
    c.fillStyle = pal.ground2; c.fillRect(x, FLOOR + 12 + (i % 3) * 6, 18, 3);
  }
  c.fillStyle = pal.mid; c.fillRect(0, 0, v.w, CEIL);
  c.fillStyle = INK; c.fillRect(0, CEIL - 1, v.w, 2);
  for (let i = 0; i < 18; i++) {
    const x = mod(i * 48 - g.camX, v.w + 96) - 48;
    c.fillStyle = pal.mid; c.beginPath(); c.ellipse(x, CEIL - 1, 18, 9 + (i % 3) * 3, 0, 0, Math.PI); c.fill();
  }
}

const DASH = [5, 6], DASH2 = [8, 5], NODASH: number[] = [];
function drawObs(c: CanvasRenderingContext2D, o: Obs, cam: number, t: number, reduce: boolean): void {
  const x1 = o.x1 - cam, x2 = o.x2 - cam;
  c.lineCap = 'round';
  if (o.kind === K_LASER) {
    // barre laser : contour encre, cœur rouge pointillé, deux émetteurs en losange
    c.strokeStyle = INK; c.lineWidth = o.r * 2 + 5; c.beginPath(); c.moveTo(x1, o.y1); c.lineTo(x2, o.y2); c.stroke();
    c.strokeStyle = '#ff3d5a'; c.lineWidth = o.r * 2; c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.4; c.setLineDash(DASH); c.lineDashOffset = reduce ? 0 : -t * 40; c.stroke(); c.setLineDash(NODASH);
    for (let e = 0; e < 2; e++) {
      const ex = e ? x2 : x1, ey = e ? o.y2 : o.y1;
      c.beginPath(); c.moveTo(ex, ey - 9); c.lineTo(ex + 8, ey); c.lineTo(ex, ey + 9); c.lineTo(ex - 8, ey); c.closePath();
      c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    }
  } else if (o.kind === K_BEAM) {
    // tir de laser : bande pleine rouge, cœur blanc, contour encre (aplats)
    const y = o.y1, h = o.r;
    c.fillStyle = INK; c.fillRect(0, y - h - 3, 4000, h * 2 + 6);
    c.fillStyle = '#ff3d5a'; c.fillRect(0, y - h, 4000, h * 2);
    c.fillStyle = '#ffffff'; c.fillRect(0, y - h * 0.35, 4000, h * 0.7);
  } else if (o.kind === K_METEOR) {
    // météorite : rocher à facettes, flamme jaune derrière
    const y = o.y1;
    c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(x1 - 8, y - 8); c.lineTo(x1, y - 46 - (reduce ? 0 : Math.sin(t * 40) * 4)); c.lineTo(x1 + 8, y - 8); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x1 - 16, y); c.lineTo(x1 - 8, y - 14); c.lineTo(x1 + 8, y - 15); c.lineTo(x1 + 17, y - 1); c.lineTo(x1 + 8, y + 13); c.lineTo(x1 - 9, y + 14); c.closePath();
    c.fillStyle = '#8a6a4f'; c.fill(); c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke();
    c.fillStyle = '#5c4331'; c.beginPath(); c.arc(x1 - 3, y + 2, 4, 0, 6.3); c.fill(); c.beginPath(); c.arc(x1 + 7, y - 5, 2.6, 0, 6.3); c.fill();
  } else if (o.kind === K_ACACIA) {
    // branche d'acacia électrifiée : bois, épines en dents de scie, éclairs jaunes
    c.strokeStyle = INK; c.lineWidth = o.r * 2 + 4; c.beginPath(); c.moveTo(x1, o.y1); c.lineTo(x2, o.y2); c.stroke();
    c.strokeStyle = '#7a4b22'; c.lineWidth = o.r * 2; c.stroke();
    const dx = x2 - x1, dy = o.y2 - o.y1, L = Math.hypot(dx, dy) || 1;
    c.fillStyle = '#2fa35b'; c.strokeStyle = INK; c.lineWidth = 1.6;
    for (let d = 14; d < L - 4; d += 18) {
      const px = x1 + (dx / L) * d, py = o.y1 + (dy / L) * d;
      const side = Math.floor(d / 18) % 2 ? 1 : -1;
      c.beginPath(); c.moveTo(px, py - 3); c.lineTo(px + side * 13, py); c.lineTo(px, py + 3); c.closePath(); c.fill(); c.stroke();
    }
    c.strokeStyle = '#ffe066'; c.lineWidth = 2; c.beginPath();
    const ph = reduce ? 0 : Math.floor(t * 12) % 3;
    for (let d = 0; d <= L; d += 9) { const j = ((d / 9 + ph) % 2 ? 1 : -1) * 4; c.lineTo(x1 + (dx / L) * d - (dy / L) * j, o.y1 + (dy / L) * d + (dx / L) * j); }
    c.stroke();
  } else {
    // missile : corps, nez pointu, ailerons, flamme
    const ny = o.y1;
    c.strokeStyle = INK; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x1 + 2, ny - 4); c.lineTo(x1 + 14, ny - 12); c.lineTo(x1 + 12, ny); c.lineTo(x1 + 14, ny + 12); c.lineTo(x1 + 2, ny + 4); c.closePath(); c.fillStyle = '#ffd23f'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x2 - 4, ny); c.lineTo(x2 + 8, ny - 8); c.lineTo(x1 + 4, ny - 8); c.lineTo(x1 + 4, ny + 8); c.lineTo(x2 + 8, ny + 8); c.closePath(); c.fillStyle = '#e8e4f0'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x2 - 4, ny - 8); c.lineTo(x2 - 4, ny + 8); c.lineTo(x2 - 12, ny); c.closePath(); c.fillStyle = '#ff3d5a'; c.fill(); c.stroke();
    c.fillStyle = '#ff3d5a'; c.beginPath(); c.moveTo(x1 + 4, ny - 5); c.lineTo(x1 + 4 + 14 + Math.sin(t * 50) * 3, ny); c.lineTo(x1 + 4, ny + 5); c.closePath(); c.fill();
    c.fillStyle = '#16110F'; c.fillRect(x2 + 10, ny - 2, 6, 4);
  }
}

function bonusIcon(c: CanvasRenderingContext2D, k: number, x: number, y: number, t: number): void {
  c.lineWidth = 2; c.strokeStyle = INK;
  const bob = Math.sin(t * 4 + x) * 2;
  y += bob;
  c.beginPath(); c.arc(x, y, 14, 0, 6.3); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
  if (k === B_SHIELD) {
    c.beginPath(); c.moveTo(x - 7, y - 7); c.lineTo(x + 7, y - 7); c.lineTo(x + 7, y + 1); c.quadraticCurveTo(x + 6, y + 8, x, y + 10); c.quadraticCurveTo(x - 6, y + 8, x - 7, y + 1); c.closePath(); c.fillStyle = '#3b82f6'; c.fill(); c.stroke();
  } else if (k === B_MAGNET) {
    c.beginPath(); c.arc(x, y + 1, 6, Math.PI, 0); c.lineWidth = 5; c.strokeStyle = INK; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#ff3d5a'; c.stroke();
    c.fillStyle = '#ffffff'; c.fillRect(x - 8.5, y + 1, 5, 5); c.fillRect(x + 3.5, y + 1, 5, 5); c.strokeStyle = INK; c.lineWidth = 1.5; c.strokeRect(x - 8.5, y + 1, 5, 5); c.strokeRect(x + 3.5, y + 1, 5, 5);
  } else if (k === B_BALLOON) {
    c.beginPath(); c.ellipse(x, y - 1, 7, 8, 0, 0, 6.3); c.fillStyle = '#16110F'; c.fill();
    c.fillStyle = '#ffffff'; c.fillRect(x - 6, y - 5, 12, 2.4); c.fillRect(x - 6, y, 12, 2.4);
  }
}

const BALLOON_STRIPES = [-80, 7, -72, 11, -62, 14, -52, 8];
function drawBalloon(c: CanvasRenderingContext2D, t: number): void {
  c.lineWidth = 2.2; c.strokeStyle = INK;
  c.beginPath(); c.moveTo(-4, -6); c.lineTo(-2, -50); c.moveTo(14, -10); c.lineTo(2, -50); c.stroke();
  c.beginPath(); c.ellipse(-1, -66, 24, 26 + Math.sin(t * 3), 0, 0, 6.3); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
  c.fillStyle = INK;
  for (let i = 0; i < BALLOON_STRIPES.length; i += 2) { c.beginPath(); c.ellipse(-1, BALLOON_STRIPES[i], BALLOON_STRIPES[i + 1] * 1.6, 3.6, 0, 0, 6.3); c.fill(); }
}

function drawDrone(c: CanvasRenderingContext2D, g: Game, v: View, t: number): void {
  const x = v.w - 56, y = g.evtDroneY + (v.reduce ? 0 : Math.sin(t * 3) * 4);
  c.lineWidth = 3; c.strokeStyle = INK;
  c.fillStyle = '#e8e4f0'; c.beginPath(); c.roundRect(x - 34, y - 16, 68, 32, 12); c.fill(); c.stroke();
  c.fillStyle = '#ff3d5a'; c.beginPath(); c.arc(x - 12, y, 7, 0, 6.3); c.fill(); c.stroke();
  c.fillStyle = '#ffd23f'; c.fillRect(x + 6, y - 6, 20, 12); c.strokeRect(x + 6, y - 6, 20, 12);
  c.fillStyle = INK; c.fillRect(x - 6, y - 26, 12, 5); c.fillRect(x - 24, y - 22, 48, 3);
  const spin = v.reduce ? 0 : Math.floor(t * 30) % 2;
  c.fillRect(x - 32 + spin * 6, y - 20, 14, 3); c.fillRect(x + 18 - spin * 6, y - 20, 14, 3);
  c.fillStyle = '#ff3d5a'; c.fillRect(x - 3, y + 16, 6, 8);
}

function drawWind(c: CanvasRenderingContext2D, g: Game, v: View, t: number): void {
  // traits de vent : leur sens suit la rafale (haut / bas)
  const dir = Math.sign(g.windForce) || 1;
  c.fillStyle = 'rgba(255,255,255,0.7)';
  const n = v.reduce ? 4 : 14;
  for (let i = 0; i < n; i++) {
    const x = mod(i * 97 + (v.reduce ? 0 : t * 260), v.w + 80) - 40;
    const y = mod(i * 53 - dir * (v.reduce ? 0 : t * 120), H - 60) + 30;
    c.fillRect(x, y, 34, 3);
  }
}

/** Avertissements avant tout danger : lignes et marques fixes sous mouvement réduit, clignotantes sinon. */
function drawWarnings(c: CanvasRenderingContext2D, g: Game, v: View, t: number): void {
  const on = v.reduce || Math.floor(t * 8) % 2 === 0;
  if (g.beamKind !== 0 && g.beamT < BEAM_WARN) {
    const k = g.beamT / BEAM_WARN;
    c.fillStyle = '#ff3d5a';
    if (g.beamKind === 1) {
      if (on) { c.fillRect(0, g.beamY - 1.5, v.w, 3); }
      c.fillRect(0, g.beamY - 14, 12 + k * 14, 28); c.fillRect(v.w - 12 - k * 14, g.beamY - 14, 12 + k * 14, 28);
    } else {
      // l'ouverture sûre : deux repères jaunes et des lignes rouges de part et d'autre
      for (const dy of [-SWEEP_HALF - 5, SWEEP_HALF + 5]) { if (on) c.fillRect(0, g.beamY + dy - 1.5, v.w, 3); }
      c.fillStyle = '#ffd23f';
      c.fillRect(0, g.beamY - SWEEP_HALF, 12, SWEEP_HALF * 2); c.fillRect(v.w - 12, g.beamY - SWEEP_HALF, 12, SWEEP_HALF * 2);
      c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(0, g.beamY - SWEEP_HALF, 12, SWEEP_HALF * 2); c.strokeRect(v.w - 12, g.beamY - SWEEP_HALF, 12, SWEEP_HALF * 2);
    }
  }
  for (let i = 0; i < POOL.meteors; i++) {
    if (g.metWarn[i] <= 0) continue;
    const x = g.metX[i] - g.camX;
    if (x < 0 || x > v.w) continue;
    const k = 1 - g.metWarn[i] / METEOR_WARN;
    c.fillStyle = '#ff3d5a'; c.fillRect(x - 2, CEIL + 22, 4, (FLOOR - CEIL) * k * 0.5);
    if (on) {
      c.beginPath(); c.moveTo(x, CEIL + 4); c.lineTo(x + 14, CEIL + 28); c.lineTo(x - 14, CEIL + 28); c.closePath();
      c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke();
    }
  }
}

function drawBanner(c: CanvasRenderingContext2D, g: Game, v: View): void {
  if (g.evtKind === 0) return;
  const el = EVENT_DUR - g.evtT;
  // bandeau d'annonce 3 s, puis une jauge fine du temps restant
  if (el < 3) {
    const w = Math.min(v.w - 2 * 24, 330), x = (v.w - w) / 2, y = 78;
    c.fillStyle = INK; c.fillRect(x - 3, y - 3, w + 6, 40 + 6);
    c.fillStyle = '#ffd23f'; c.fillRect(x, y, w, 40);
    c.fillStyle = INK; c.font = '700 20px Fredoka, ui-rounded, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(EVENT_NAMES[g.evtKind], v.w / 2, y + 21);
  }
  const w = Math.min(v.w - 2 * 24, 200), x = (v.w - w) / 2;
  c.fillStyle = INK; c.fillRect(x - 2, 64, w + 4, 10);
  c.fillStyle = '#ffd23f'; c.fillRect(x, 66, w * Math.max(0, g.evtT / EVENT_DUR), 6);
}

export function render(c: CanvasRenderingContext2D, g: Game, lo: Loadout, v: View, time: number, trailId: string): void {
  background(c, g, v);
  const cam = g.camX;
  // pièces
  c.lineWidth = 2; c.strokeStyle = INK;
  for (let i = 0; i < POOL.coins; i++) {
    if (!g.coinOn[i]) continue;
    const x = g.coinX[i] - cam;
    if (x < -20 || x > v.w + 20) continue;
    const squash = v.reduce ? 1 : Math.abs(Math.cos(time * 4 + i * 0.7)) * 0.55 + 0.45;
    c.beginPath(); c.ellipse(x, g.coinY[i], 8 * squash, 8, 0, 0, 6.3); c.fillStyle = '#ffc928'; c.fill(); c.stroke();
    c.beginPath(); c.ellipse(x, g.coinY[i], 3.4 * squash, 4.6, 0, 0, 6.3); c.strokeStyle = '#c98a00'; c.lineWidth = 1.5; c.stroke(); c.strokeStyle = INK; c.lineWidth = 2;
  }
  for (let i = 0; i < POOL.bonus; i++) if (g.bonOn[i]) bonusIcon(c, g.bonK[i], g.bonX[i] - cam, g.bonY[i], time);
  for (const o of g.obs) if (o.active && Math.max(o.x1, o.x2) - cam > -40 && Math.min(o.x1, o.x2) - cam < v.w + 40) drawObs(c, o, cam, time, v.reduce);
  for (const m of g.missiles) if (m.active) drawObs(c, m, cam, time, v.reduce);
  for (const m of g.meteors) if (m.active) drawObs(c, m, cam, time, v.reduce);
  for (const m of g.beams) if (m.active) drawObs(c, m, cam, time, v.reduce);
  if (g.evtKind === E_DRONE) drawDrone(c, g, v, time);
  if (g.evtKind === E_WIND) drawWind(c, g, v, time);
  // traînée
  for (let i = 0; i < POOL.parts; i++) {
    if (g.pLife[i] <= 0) continue;
    const k = g.pLife[i] / 0.7;
    drawTrailShape(c, trailId, g.pX[i] - cam, g.pY[i], 5 + (1 - k) * 5, g.pSeed[i]);
  }
  // Gigi (clignote après un coup absorbé, sauf mouvement réduit)
  const blink = g.invuln > 0 && !v.reduce && Math.floor(time * 14) % 2 === 0;
  if (!blink) {
    c.save();
    c.translate(g.x - cam, g.y);
    if (g.balloonT > 0) drawBalloon(c, time);
    drawGigi(c, lo, { vy: g.vy, t: time, speed: g.speed, thrusting: g.thrusting && g.mode === 'run', dead: g.mode !== 'run', calm: v.reduce });
    if (g.shield) {
      c.beginPath(); c.arc(2, -8, 34, 0, 6.3); c.lineWidth = 3; c.strokeStyle = '#3b82f6'; c.setLineDash(DASH2); c.stroke(); c.setLineDash(NODASH);
    }
    c.restore();
  }
  // avertissements de missile : icône + bord d'écran (fixe si mouvement réduit)
  for (let i = 0; i < POOL.missiles; i++) {
    if (g.warnT[i] <= 0) continue;
    const y = g.warnY[i];
    const on = v.reduce || Math.floor(time * 8) % 2 === 0;
    c.fillStyle = '#ff3d5a'; c.fillRect(v.w - 10, y - 20, 10, 40);
    if (on) {
      c.beginPath(); c.moveTo(v.w - 40, y - 18); c.lineTo(v.w - 14, y + 16); c.lineTo(v.w - 66, y + 16); c.closePath();
      c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke();
      c.fillStyle = INK; c.fillRect(v.w - 41, y - 7, 3, 12); c.fillRect(v.w - 41, y + 8, 3, 3);
    }
  }
  drawWarnings(c, g, v, time);
  drawBanner(c, g, v);
  if (v.flash > 0 && !v.reduce) { c.fillStyle = `rgba(255,255,255,${v.flash * 0.6})`; c.fillRect(0, 0, v.w, H); }
  void B_MAGNET; void star;
}
