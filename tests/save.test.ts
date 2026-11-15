import { describe, expect, it } from 'vitest';
import { ITEMS, UPGRADES, itemsOf } from '../src/catalog';
import { TUTO_KIND, applyRun, compositionFor, fillMissions, pickMission } from '../src/missions';
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
    const s = migrate({ coins: 'beaucoup', upgrades: { magnet: 99, jetpack: -3, x: 1 }, owned: ['coat-zebra', 'nimporte'], equipped: { hat: 'head-crown', coat: 'coat-zebra' }, missions: [{ kind: 'zzz' }, null], extra: 1 });
    expect(s.coins).toBe(0);
    expect(s.upgrades.magnet).toBe(5);
    expect(s.upgrades.jetpack).toBe(0);
    expect(s.owned).toContain('coat-zebra');
    expect(s.owned).not.toContain('nimporte');
    expect(s.equipped.coat).toBe('coat-zebra');
    expect(s.equipped.hat).toBe('head-none'); // non possédé
    expect(s.missions).toHaveLength(1); // pas encore jouée : mission tuto
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
  it('20 cosmétiques, répartis 5/5/4/3/3', () => {
    const count = (s: 'coat' | 'hat' | 'pack' | 'trail' | 'scarf') => itemsOf(s).length;
    expect(count('coat')).toBe(5);
    expect(count('hat')).toBe(5);
    expect(count('pack')).toBe(4);
    expect(count('trail')).toBe(3);
    expect(count('scarf')).toBe(3);
    expect(ITEMS.length).toBe(20);
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

describe('missions et compteur', () => {
  it('1re partie : une seule mission, le tuto (+50, compteur = 1), validé quel que soit le score', () => {
    const s = defaultSave();
    expect(s.missions.map((m) => m.kind)).toEqual([TUTO_KIND]);
    const r = applyRun(s.missions, { dist: 0, coins: 0, grazes: 0, bonuses: 0, balloons: 0 }, 5, 0);
    expect(r.done).toHaveLength(1);
    expect(r.done[0].reward).toBe(50);
    expect(r.missions).toHaveLength(3);
    expect(new Set(r.missions.map((m) => m.kind)).size).toBe(3);
    expect(r.missions.every((m) => m.kind !== TUTO_KIND && m.tier === 0)).toBe(true);
  });
  it('paliers 3 et 8 : composition et récompenses 40 / 80 / 150', () => {
    expect(compositionFor(1)).toEqual([0, 0, 0]);
    expect(compositionFor(3)).toEqual([0, 0, 1]);
    expect(compositionFor(7)).toEqual([0, 0, 1]);
    expect(compositionFor(8)).toEqual([0, 1, 2]);
    const tiers = (n: number) => fillMissions([], 11, n).map((m) => m.tier).sort();
    expect(tiers(2)).toEqual([0, 0, 0]);
    expect(tiers(5)).toEqual([0, 0, 1]);
    expect(tiers(9)).toEqual([0, 1, 2]);
    expect(fillMissions([], 3, 9).map((m) => m.reward).sort((a, b) => a - b)).toEqual([40, 80, 150]);
    expect(new Set(fillMissions([], 3, 9).map((m) => m.kind)).size).toBe(3);
  });
  it('sauvegarde : pas de xp ni de niveau, tuto marqué fait après une partie', () => {
    const s = migrate({ xp: 999, games: 2, missionsDone: 4 });
    expect('xp' in s).toBe(false);
    expect(s.tutoDone).toBe(true);
    expect(s.missions).toHaveLength(3);
    expect(migrate({}).missions.map((m) => m.kind)).toEqual([TUTO_KIND]);
  });
  it('une mission accomplie est remplacée et rapporte sa récompense', () => {
    const base = fillMissions([], 1, 1);
    const r = applyRun(base, { dist: 99999, coins: 99999, grazes: 99, bonuses: 99, balloons: 9 }, 50);
    expect(r.done.length).toBe(3);
    expect(r.missions).toHaveLength(3);
    expect(r.missions.every((m) => m.progress === 0)).toBe(true);
  });
});

describe('catalogue aligné sur l’équilibrage (20 cosmétiques)', () => {
  it('compte 5/5/4/3/3 et offre les objets de mission au bon compteur', async () => {
    const { ITEMS, itemsOf, freeIds, isUnlocked, itemById } = await import('../src/catalog');
    expect(ITEMS.length).toBe(20);
    expect(['coat', 'hat', 'pack', 'trail', 'scarf'].map((s) => itemsOf(s as never).length)).toEqual([5, 5, 4, 3, 3]);
    expect(freeIds(0).sort()).toEqual(['coat-classic', 'pack-retro', 'scarf-stripes', 'trail-smoke']);
    expect(freeIds(1)).toContain('head-goggles');
    expect(freeIds(24)).not.toContain('head-crown');
    expect(freeIds(25)).toContain('head-crown');
    expect(isUnlocked(itemById('coat-stars')!, { missionsDone: 18 })).toBe(false);
    expect(ITEMS.filter((i) => i.price > 0).reduce((a, i) => a + i.price, 0)).toBe(2450);
  });
  it('une sauvegarde à 19 missions possède le pelage nuit étoilée', () => {
    expect(migrate({ missionsDone: 19 }).owned).toContain('coat-stars');
  });
});
