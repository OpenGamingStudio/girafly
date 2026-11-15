import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/catalog';
import { bakeStats, drawGigi, drawTrailShape, setCanvasFactory, Loadout } from '../src/art';
import { DEFAULT_LOADOUT } from '../src/catalog';

/** Faux canvas : compte les créations, les drawImage et les tracés ; ne dessine rien. */
const calls = { created: 0, drawImage: 0 };
function fakeCtx(isBitmap: boolean): CanvasRenderingContext2D {
  const base: Record<string, unknown> = {};
  return new Proxy(base, {
    get(t, k: string) {
      if (k === 'drawImage') return () => { if (!isBitmap) calls.drawImage++; };
      if (k in t) return t[k];
      return () => undefined;
    },
    set(t, k: string, v) { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}
function factory(): HTMLCanvasElement {
  calls.created++;
  const cv = { width: 0, height: 0 } as unknown as HTMLCanvasElement;
  const ctx = fakeCtx(true);
  (cv as unknown as { getContext: () => CanvasRenderingContext2D }).getContext = () => ctx;
  return cv;
}

describe('cosmétiques : rendu bitmap unique, rien créé par image', () => {
  it('chaque objet est dessiné une seule fois ; ensuite seuls des drawImage', () => {
    setCanvasFactory(factory);
    const main = fakeCtx(false);
    const loadouts: Loadout[] = [];
    for (const it of ITEMS) loadouts.push({ ...DEFAULT_LOADOUT, [it.slot]: it.id });
    const frame = (t: number) => {
      for (const lo of loadouts) drawGigi(main, lo, { vy: Math.sin(t) * 300, t, speed: 300, thrusting: true });
      for (const id of ['trail-smoke', 'trail-stars', 'trail-hearts']) drawTrailShape(main, id, 10, 10, 8, 0.5);
    };
    frame(0);
    const baked = bakeStats.count;
    expect(baked).toBe(calls.created);
    expect(baked).toBeGreaterThan(20);
    const draws = calls.drawImage;
    for (let i = 1; i <= 600; i++) frame(i / 60);
    expect(bakeStats.count).toBe(baked); // aucun bitmap refait
    expect(calls.created).toBe(baked); // aucun canvas créé par image
    expect(calls.drawImage).toBeGreaterThan(draws);
  });
  it('mouvement réduit : l’hélice ne tourne pas (même rendu à deux instants)', () => {
    setCanvasFactory(factory);
    const rot: number[] = [];
    const c = new Proxy({}, { get: (_t, k: string) => (k === 'rotate' ? (a: number) => rot.push(a) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    const lo = { ...DEFAULT_LOADOUT, hat: 'head-propeller' };
    drawGigi(c, lo, { vy: 0, t: 1, speed: 300, thrusting: false, calm: true });
    const a = rot.slice(); rot.length = 0;
    drawGigi(c, lo, { vy: 0, t: 2.3, speed: 300, thrusting: false, calm: true });
    expect(rot).toEqual(a);
    rot.length = 0;
    drawGigi(c, lo, { vy: 0, t: 1, speed: 300, thrusting: false });
    const b = rot.slice(); rot.length = 0;
    drawGigi(c, lo, { vy: 0, t: 2.3, speed: 300, thrusting: false });
    expect(rot).not.toEqual(b);
  });
});
