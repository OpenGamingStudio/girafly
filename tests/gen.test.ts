import { describe, expect, it } from 'vitest';
import { PATH_PAD, SEG_LEN } from '../src/config';
import { B_SHIELD, MAX_PATH_DELTA, generate, newSeg, pathY } from '../src/gen';
import { playerGap, PY_MAX, PY_MIN } from '../src/geom';
import { Rng } from '../src/rng';

describe('générateur de segments : garantie de passage', () => {
  it('la trajectoire garantie ne touche aucun obstacle (360 segments, toutes difficultés)', () => {
    const s = newSeg();
    for (let seed = 1; seed <= 12; seed++) {
      const r = new Rng(seed);
      let x = 0;
      let y = 200;
      for (let i = 0; i < 30; i++) {
        generate(s, r, x, y, { diff: Math.min(1, i / 20), calm: i === 0, shieldChance: 0.3 });
        for (let px = s.x0; px <= s.x0 + s.len; px += 6) {
          const py = pathY(s, px);
          expect(py).toBeGreaterThanOrEqual(PY_MIN);
          expect(py).toBeLessThanOrEqual(PY_MAX);
          for (let k = 0; k < s.nObs; k++) {
            expect(playerGap(px, py, 0, s.obs[k], PATH_PAD)).toBeGreaterThanOrEqual(0);
          }
        }
        x += SEG_LEN;
        y = s.yOut;
      }
    }
  });

  it('les segments s’enchaînent sans saut et la pente reste franchissable', () => {
    const s = newSeg();
    const r = new Rng(7);
    let y = 200;
    for (let i = 0; i < 100; i++) {
      generate(s, r, i * SEG_LEN, y, { diff: 1, calm: false, shieldChance: 0.3 });
      expect(Math.abs(pathY(s, s.x0) - y)).toBeLessThan(PY_MAX); // départ = sortie précédente (après bornes)
      expect(Math.abs(s.yOut - s.yIn)).toBeLessThanOrEqual(MAX_PATH_DELTA + 0.001);
      // pente max d'une smoothstep = 1,5 Δ/len : doit rester bien sous la vitesse verticale de Gigi
      expect((1.5 * MAX_PATH_DELTA) / SEG_LEN).toBeLessThan(0.5);
      y = s.yOut;
    }
  });

  it('le premier segment est calme et les segments suivants contiennent des obstacles', () => {
    const s = newSeg();
    generate(s, new Rng(3), 0, 200, { diff: 0, calm: true, shieldChance: 0.2 });
    expect(s.nObs).toBe(0);
    let any = 0;
    for (let i = 0; i < 20; i++) {
      generate(s, new Rng(i), 0, 200, { diff: 0.8, calm: false, shieldChance: 0.2 });
      any += s.nObs;
    }
    expect(any).toBeGreaterThan(10);
  });

  it('est déterministe pour une même graine', () => {
    const a = newSeg();
    const b = newSeg();
    generate(a, new Rng(99), 0, 200, { diff: 0.5, calm: false, shieldChance: 0.2 });
    generate(b, new Rng(99), 0, 200, { diff: 0.5, calm: false, shieldChance: 0.2 });
    expect(a.nObs).toBe(b.nObs);
    expect(a.yOut).toBe(b.yOut);
    expect(a.nCoins).toBe(b.nCoins);
  });
});

describe('tirage des bonus', () => {
  it('ne pose jamais deux fois le même bonus de suite et respecte la recharge du bouclier', () => {
    const s = newSeg();
    const r = new Rng(11);
    let last = -1;
    let shields = 0;
    let lastShield = -1e9;
    for (let i = 1; i < 4000; i++) {
      const x = i * SEG_LEN;
      const shieldOk = x - lastShield >= 5500;
      generate(s, r, x, 200, { diff: 0.5, calm: false, shieldChance: 0.48, lastBonus: last, shieldOk });
      if (s.nBonus) {
        expect(s.bk[0]).not.toBe(last);
        if (s.bk[0] === B_SHIELD) { expect(shieldOk).toBe(true); lastShield = s.bx[0]; shields++; }
        last = s.bk[0];
      }
    }
    expect(shields).toBeGreaterThan(50);
  });
});
