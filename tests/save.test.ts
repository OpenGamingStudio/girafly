import { describe, expect, it } from 'vitest';
import { ITEMS, UPGRADES, itemsOf } from '../src/catalog';
import { MAX_LEVEL, applyRun, levelOf, pickMission, xpFor } from '../src/missions';
import { SAVE_KEY, SAVE_VERSION, defaultSave, load, migrate, persist } from '../src/save';

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } }

describe('sauvegarde', () => {
  it('aller-retour fidèle', () => {
    const s = defaultSave();
    s.coins = 123; s.upgrades.magnet = 3; s.bestDist = 456;
    const st = new Mem();
    persist(st, s);
    const r = load(st);
    expect(r.coins).toBe(123);
    expect(r.upgrades.magnet).toBe(3);
    expect(r.v).toBe(SAVE_VERSION);
  });
  it('tolère le JSON abîmé, les types faux, les valeurs hors bornes et les champs inconnus', () => {
    const st = new Mem();
    st.setItem(SAVE_KEY, '{pas du json');
    expect(load(st).coins).toBe(0);
    const s = migrate({ coins: 'beaucoup', upgrades: { magnet: 99, jetpack: -3, x: 1 }, owned: ['coat-zebre', 'nimporte'], equipped: { hat: 'hat-couronne', coat: 'coat-zebre' }, missions: [{ kind: 'zzz' }, null], extra: 1 });
    expect(s.coins).toBe(0);
    expect(s.upgrades.magnet).toBe(5);
    expect(s.upgrades.jetpack).toBe(0);
    expect(s.owned).toContain('coat-zebre');
    expect(s.owned).not.toContain('nimporte');
    expect(s.equipped.coat).toBe('coat-zebre');
    expect(s.equipped.hat).toBe('hat-none'); // non possédé
    expect(s.missions).toHaveLength(3);
  });
  it('fonctionne sans stockage (navigation privée)', () => {
    expect(load(null).coins).toBe(0);
    expect(() => persist(null, defaultSave())).not.toThrow();
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(load(bad).coins).toBe(0);
    expect(() => persist(bad, defaultSave())).not.toThrow();
  });
  it('accepte une version plus récente sans planter', () => {
    expect(migrate({ v: 99, coins: 5 }).coins).toBe(5);
  });
});

describe('catalogue', () => {
  it('au moins 30 cosmétiques, répartis comme le brief', () => {
    const count = (s: 'coat' | 'hat' | 'pack' | 'trail' | 'scarf') => itemsOf(s).length;
    expect(count('coat')).toBe(8);
    expect(count('hat')).toBe(8);
    expect(count('pack')).toBe(6);
    expect(count('trail')).toBe(6);
    expect(count('scarf')).toBe(4);
    expect(ITEMS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });
  it('5 améliorations à 5 niveaux, coûts croissants', () => {
    expect(UPGRADES).toHaveLength(5);
    for (const u of UPGRADES) {
      expect(u.costs).toHaveLength(5);
      for (let i = 1; i < 5; i++) expect(u.costs[i]).toBeGreaterThan(u.costs[i - 1]);
    }
  });
});

describe('missions et niveaux', () => {
  it('3 missions de types différents', () => {
    expect(new Set(defaultSave().missions.map((m) => m.kind)).size).toBe(3);
  });
  it('une mission accomplie est remplacée et rapporte sa récompense', () => {
    const base = [pickMission(1, []), pickMission(2, []), pickMission(3, [])];
    const r = applyRun(base, { dist: 99999, coins: 99999, grazes: 99, bonuses: 99, balloons: 9 }, 50);
    expect(r.done.length).toBe(3);
    expect(r.missions).toHaveLength(3);
    expect(r.missions.every((m) => m.progress === 0)).toBe(true);
  });
  it('niveaux 1 à 20', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(xpFor(5))).toBe(5);
    expect(levelOf(1e9)).toBe(MAX_LEVEL);
  });
});
