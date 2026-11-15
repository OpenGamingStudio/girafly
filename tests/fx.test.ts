import { describe, expect, it } from 'vitest';
import { boom, clearFx, coinBurst, drawFx, liveCount, smoke, sparks, updateFx } from '../src/fx';
import { drawBackground, PALS } from '../src/scenery';
import { Game } from '../src/sim';

/** Faux contexte : refuse tout dégradé, compte les tracés. */
function ctx(): CanvasRenderingContext2D {
  const t: Record<string, unknown> = {};
  return new Proxy(t, {
    get(o, k: string) {
      if (/Gradient|createPattern/.test(k)) throw new Error('dégradé interdit : ' + k);
      if (k in o) return o[k];
      return () => undefined;
    },
    set(o, k: string, v) { o[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

describe('particules', () => {
  it('le pool est borné, les particules meurent, le mouvement réduit en émet moins', () => {
    clearFx();
    for (let i = 0; i < 1000; i++) smoke(0, 0);
    expect(liveCount()).toBeLessThanOrEqual(220);
    clearFx();
    boom(0, 0, false);
    const full = liveCount();
    clearFx();
    boom(0, 0, true);
    expect(liveCount()).toBeLessThan(full);
    clearFx(); coinBurst(0, 0, false); sparks(0, 0, 9, false);
    for (let i = 0; i < 120; i++) updateFx(1 / 60);
    expect(liveCount()).toBe(0);
  });
  it('le dessin ne crée aucun dégradé', () => {
    clearFx(); boom(10, 10, false); smoke(5, 5); coinBurst(3, 3, false);
    expect(() => drawFx(ctx(), 0)).not.toThrow();
  });
});

describe('décors', () => {
  it('chaque biome se dessine sans dégradé, à toute largeur, avec ou sans mouvement réduit', () => {
    const g = new Game(7);
    for (const [x, w, reduce] of [[0, 320, false], [30000, 844, true], [50000, 1200, false]] as const) {
      g.x = x;
      expect(() => drawBackground(ctx(), g, { w, reduce }, 3.2)).not.toThrow();
    }
    expect(PALS).toHaveLength(3);
  });
});
