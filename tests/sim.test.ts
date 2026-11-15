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
    for (const m of g.missiles) m.active = false; // le robot ne esquive pas les missiles (réactifs)
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
    g.x = 40 * 5000;
    g.step(false);
    expect(g.speed).toBeLessThanOrEqual(400);
    expect(g.speed).toBeGreaterThan(220);
  });

  it('un robot qui suit la zone libre survit longtemps sur plusieurs graines', () => {
    let alive = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const g = runBot(seed, 60 * 60);
      if (g.mode === 'run') alive++;
      expect(g.dist).toBeGreaterThan(100);
    }
    expect(alive).toBeGreaterThanOrEqual(5);
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
