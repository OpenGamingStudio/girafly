import { describe, expect, it } from 'vitest';
import { WARN_TIME } from '../src/config';
import { EV_GRAZE } from '../src/sim';
import { Game, perksFor } from '../src/sim';
import { Obs, newObs } from '../src/geom';

/** Robot : suit la trajectoire garantie du générateur ; prouve qu'elle est jouable avec la vraie physique. */
function runBot(seed: number, ticks: number): Game {
  const g = new Game(seed);
  g.setView(640);
  for (let i = 0; i < ticks && g.mode === 'run'; i++) {
    g.beamKind = 0; // le robot n'esquive pas les dangers réactifs (lasers, missiles, météorites)
    for (const m of [...g.missiles, ...g.beams, ...g.meteors]) m.active = false;
    const tg = g.guideY(g.x + 50);
    g.step(g.y + g.vy * 0.12 > (tg < 0 ? 200 : tg));
  }
  return g;
}

describe('simulation', () => {
  it('Gigi monte en maintenant, descend en relâchant, et reste entre sol et plafond', () => {
    const g = new Game(1);
    g.setView(640);
    const y0 = g.y;
    for (let i = 0; i < 30; i++) g.step(true);
    expect(g.y).toBeLessThan(y0);
    for (let i = 0; i < 400; i++) g.step(false);
    expect(g.y).toBeGreaterThan(y0);
    for (let i = 0; i < 400; i++) g.step(true);
    expect(g.y).toBeGreaterThanOrEqual(60);
  });

  it('la vitesse monte doucement et reste bornée', () => {
    const g = new Game(2);
    g.setView(640);
    g.t = 3600;
    g.step(false);
    expect(g.speed).toBeLessThanOrEqual(400);
    expect(g.speed).toBeGreaterThan(220);
  });

  it('un robot qui suit la zone libre survit longtemps sur plusieurs graines', () => {
    let alive = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const g = runBot(seed, 150 * 60);
      if (g.mode === 'run') alive++;
      expect(g.dist).toBeGreaterThan(100);
    }
    expect(alive).toBeGreaterThanOrEqual(7);
  });

  it('un obstacle touché termine la partie ; le bouclier absorbe un coup', () => {
    const g = new Game(3);
    g.setView(640);
    const set = (o: Obs) => { o.active = true; o.kind = 0; o.r = 6; o.x1 = g.x - 20; o.x2 = g.x + 20; o.y1 = o.y2 = g.y; o.grazed = true; };
    g.shield = true;
    set(g.obs[0]);
    g.step(false);
    expect(g.mode).toBe('run');
    expect(g.shield).toBe(false);
    g.invuln = 0;
    set(g.obs[1]);
    g.step(false);
    expect(g.mode).toBe('dying');
    for (let i = 0; i < 80; i++) g.step(false);
    expect(g.mode).toBe('over');
  });

  it('hitbox : le cou est exclu (un laser entre le corps et la tête ne tue pas)', () => {
    const g = new Game(4);
    g.setView(640);
    const o = g.obs[0];
    o.active = true; o.kind = 0; o.r = 2; o.grazed = true;
    // fin laser vertical à mi-cou, devant le cou (x - 4), entre corps (y+2±12) et tête (y-30±9)
    o.x1 = o.x2 = g.x + 3; o.y1 = g.y - 17; o.y2 = g.y - 14;
    g.step(false);
    expect(g.mode).toBe('run');
  });

  it('frôler un laser avec la tête donne +1 frôlé et des pièces bonus, une seule fois', () => {
    const g = new Game(5);
    g.setView(640);
    const o = g.obs[0];
    o.active = true; o.kind = 0; o.r = 4; o.grazed = false;
    o.x1 = g.x - 60; o.x2 = g.x + 60; o.y1 = o.y2 = g.y - 30 - 9 - 4 - 6; // juste au-dessus de la tête
    g.step(false);
    expect(g.grazes).toBe(1);
    expect(g.takeEvents() & EV_GRAZE).toBeTruthy();
    expect(g.mode).toBe('run');
    const before = g.rawCoins;
    g.step(false);
    expect(g.grazes).toBe(1);
    expect(g.rawCoins).toBeGreaterThanOrEqual(before);
  });

  it('un missile est annoncé au moins 1 s avant d’apparaître', () => {
    const g = new Game(6);
    g.setView(640);
    g.t = 20;
    g.x = 40 * 200;
    let warnedAt = -1;
    let spawnedAt = -1;
    for (let i = 0; i < 60 * 30 && spawnedAt < 0; i++) {
      g.y = 180; g.vy = 0;
      for (const o of g.obs) o.active = false; // pour ne pas mourir pendant le test
      g.step(false);
      if (warnedAt < 0 && g.warnT.some((w) => w > 0)) warnedAt = g.t;
      if (g.missiles.some((m) => m.active)) spawnedAt = g.t;
    }
    expect(warnedAt).toBeGreaterThan(0);
    expect(spawnedAt - warnedAt).toBeGreaterThanOrEqual(WARN_TIME - 0.05);
  });

  it('les effets des améliorations sont bornés', () => {
    const lo = perksFor({ jetpack: 0, magnet: 0, shield: 0, balloon: 0, mult: 0 });
    const hi = perksFor({ jetpack: 99, magnet: 99, shield: 99, balloon: 99, mult: 99 });
    expect(lo.coinMult).toBe(1);
    expect(hi.coinMult).toBe(1.5);
    expect(hi.startShield).toBe(true);
    expect(lo.startShield).toBe(false);
    expect(hi.thrust).toBeLessThan(1.25);
  });

  it('aucune allocation d’objet par pas : les pools gardent la même taille', () => {
    const g = new Game(8);
    g.setView(640);
    const n = g.obs.length;
    for (let i = 0; i < 3000; i++) { g.y = 180; g.vy = 0; g.step(i % 7 < 3); if (g.mode !== 'run') break; }
    expect(g.obs.length).toBe(n);
  });
});

import { E_DRONE, EV_EVENT, EV_EVENT_END, BEAM_WARN, diffAt, speedAt } from '../src/sim';
import { RAMP_T, SPEED0 } from '../src/config';
import { K_LASER, playerGap } from '../src/geom';
import { generate, newSeg, pathClear, pickPattern } from '../src/gen';
import { Rng } from '../src/rng';

describe('difficulté V2', () => {
  it('la vitesse monte par paliers de +5 % toutes les 20 s, sans dépasser le plafond', () => {
    expect(speedAt(0)).toBe(SPEED0);
    expect(speedAt(19)).toBe(SPEED0);
    expect(speedAt(10)).toBe(SPEED0);
    expect(speedAt(21.5)).toBeCloseTo(SPEED0 * 1.05, 5);
    expect(speedAt(41.5)).toBeCloseTo(SPEED0 * 1.1, 5);
    expect(speedAt(10_000)).toBeCloseTo(SPEED0 * 1.8, 5);
  });

  it('la difficulté croît avec la distance et la rampe reste douce', () => {
    expect(diffAt(0)).toBe(0);
    expect(diffAt(SPEED0 * RAMP_T)).toBeCloseTo(0.1, 5);
    expect(diffAt(1e6)).toBe(1);
    expect(diffAt(20000)).toBeGreaterThan(diffAt(10000));
  });

  it('le director ne propose que des patterns simples au début, tous à haute difficulté', () => {
    const r = new Rng(1);
    for (let i = 0; i < 200; i++) expect(pickPattern(0.1, r)).toBe('scatter');
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(pickPattern(0.9, r));
    expect([...seen].sort()).toEqual(['corridor', 'gate', 'scatter', 'zigzag']);
  });

  it('chaque segment généré garde une trajectoire libre, y compris aux deux extrêmes des portes', () => {
    const r = new Rng(9);
    const s = newSeg();
    let moving = 0;
    for (let k = 0; k < 400; k++) {
      generate(s, r, 360 * k, 150 + (k % 5) * 20, { diff: (k % 10) / 9, calm: false, shieldChance: 0.2 });
      for (let i = 0; i < s.nObs; i++) {
        const o = s.obs[i];
        if (o.amp > 0) {
          moving++;
          expect(o.kind).toBe(K_LASER);
          for (const sg of [-1, 1]) {
            const q = { ...o, y1: o.b1 + sg * o.amp, y2: o.b2 + sg * o.amp };
            expect(pathClear(s, q)).toBe(true);
          }
        } else expect(pathClear(s, o)).toBe(true);
      }
    }
    expect(moving).toBeGreaterThan(10);
  });

  it('aucun danger tiré pendant la rampe d’accueil', () => {
    const g = new Game(3);
    g.setView(640);
    for (let i = 0; i < 60 * 14 && g.mode === 'run'; i++) {
      g.y = 180; g.vy = 0;
      for (const o of g.obs) o.active = false;
      g.step(false);
      expect(g.warnT.every((w) => w <= 0)).toBe(true);
      expect(g.beamKind).toBe(0);
      expect(g.evtKind).toBe(0);
    }
  });

  it('un laser à charge est annoncé BEAM_WARN s avant de tirer ; un événement se termine par une récompense', () => {
    const g = new Game(4);
    g.setView(640);
    g.t = RAMP_T + 1;
    g.x = 40 * 300;
    let warn = -1, fire = -1, evStart = false, evEnd = false;
    const coins0 = g.rawCoins;
    for (let i = 0; i < 60 * 300 && !evEnd; i++) {
      g.y = 180; g.vy = 0; g.invuln = 9;
      for (const o of g.obs) o.active = false;
      g.step(false);
      if (g.beamKind === 1 && warn < 0) warn = g.t;
      if (g.beamKind === 1 && g.beams[0].active && fire < 0) fire = g.t;
      const e = g.takeEvents();
      if (e & EV_EVENT) evStart = true;
      if (e & EV_EVENT_END) evEnd = true;
      if (g.mode !== 'run') break;
    }
    if (warn > 0 && fire > 0) expect(fire - warn).toBeGreaterThanOrEqual(BEAM_WARN - 0.05);
    expect(evStart).toBe(true);
    expect(evEnd).toBe(true);
    expect(g.rawCoins).toBeGreaterThan(coins0);
    expect(g.eventsDone).toBe(1);
    void E_DRONE;
  });

  it('robot : un laser (à charge ou à balayage) laisse toujours un passage, sur 20 graines', () => {
    let beams = 0, sweeps = 0, deaths = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = new Game(seed);
      g.setView(640);
      let prev = 0;
      for (let i = 0; i < 250 * 60 && g.mode === 'run'; i++) {
        for (const m of [...g.missiles, ...g.meteors]) m.active = false;
        if (g.beamKind !== 0 && prev === 0) { beams++; if (g.beamKind === 2) sweeps++; }
        prev = g.beamKind;
        const tg = g.guideY(g.x + 50);
        g.step(g.y + g.vy * 0.12 > (tg < 0 ? 200 : tg));
        if (g.mode !== 'run' && g.beams.some((b) => b.active && playerGap(g.x, g.y, g.vy, b) < 0)) deaths++;
      }
    }
    expect(sweeps).toBeGreaterThan(10);
    expect(beams - sweeps).toBeGreaterThan(5);
    expect(deaths).toBe(0);
  }, 60000);
});
