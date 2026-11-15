import { Rng } from './rng';

export interface RunStats { dist: number; coins: number; grazes: number; bonuses: number; balloons: number }
/** tier : 0 facile, 1 moyenne, 2 difficile (absent = facile). */
export interface Mission { kind: string; target: number; progress: number; reward: number; tier?: number }

interface Tpl { kind: string; text: (n: number) => string; targets: number[]; rewards: number[]; max?: boolean; get: (s: RunStats) => number }
export const TEMPLATES: Tpl[] = [
  { kind: 'dist', text: (n) => `Parcourir ${n} m au total`, targets: [600, 1000, 1500], rewards: [40, 70, 110], get: (s) => s.dist },
  { kind: 'coins', text: (n) => `Ramasser ${n} pièces`, targets: [150, 300, 500], rewards: [40, 70, 110], get: (s) => s.coins },
  { kind: 'graze', text: (n) => `Frôler ${n} lasers avec la tête`, targets: [3, 5, 8], rewards: [40, 60, 100], get: (s) => s.grazes },
  { kind: 'best', text: (n) => `Atteindre ${n} m en une partie`, targets: [250, 400, 600], rewards: [40, 70, 120], max: true, get: (s) => s.dist },
  { kind: 'bonus', text: (n) => `Ramasser ${n} bonus`, targets: [3, 5, 8], rewards: [30, 50, 80], get: (s) => s.bonuses },
  { kind: 'balloon', text: (n) => `Voler ${n} fois en Ballon-zèbre`, targets: [1, 2, 3], rewards: [40, 70, 100], get: (s) => s.balloons },
];

/** Mission tuto : validée à la fin de la 1re partie, quel que soit le score. */
export const TUTO_KIND = 'tuto';
export const TUTO_REWARD = 50;
export const tutoMission = (): Mission => ({ kind: TUTO_KIND, target: 1, progress: 0, reward: TUTO_REWARD });
export const isMissionKind = (k: string): boolean => k === TUTO_KIND || TEMPLATES.some((t) => t.kind === k);
/** Récompenses par difficulté (équilibrage de Nora §5). */
export const TIER_REWARD = [40, 80, 150];
/** Compositions des 3 missions actives selon le compteur de missions accomplies : paliers 3 et 8. */
export const TIER_MEDIUM_FROM = 3;
export const TIER_HARD_FROM = 8;
export const compositionFor = (counter: number): number[] =>
  counter >= TIER_HARD_FROM ? [0, 1, 2] : counter >= TIER_MEDIUM_FROM ? [0, 0, 1] : [0, 0, 0];

export const missionText = (m: Mission): string =>
  m.kind === TUTO_KIND ? 'Premier vol ! Décolle et vole.' : (TEMPLATES.find((t) => t.kind === m.kind) ?? TEMPLATES[0]).text(m.target);

/** Tire une mission dont le type n'est pas déjà actif. */
export function pickMission(seed: number, active: Mission[], tier = 0): Mission {
  const r = new Rng(seed * 7919 + 13);
  const free = TEMPLATES.filter((t) => !active.some((m) => m.kind === t.kind));
  const pool = free.length ? free : TEMPLATES;
  const t = pool[r.int(0, pool.length - 1)];
  const k = Math.min(tier, t.targets.length - 1);
  return { kind: t.kind, target: t.targets[k], progress: 0, reward: TIER_REWARD[tier] ?? t.rewards[k], tier };
}

/** Complète à 3 missions actives pour que la composition du palier soit respectée. */
export function fillMissions(active: Mission[], seed: number, counter: number): Mission[] {
  const out = active.filter((m) => m.kind !== TUTO_KIND).slice(0, 3);
  const want = compositionFor(counter).slice();
  for (const m of out) { const i = want.indexOf(m.tier ?? 0); if (i >= 0) want.splice(i, 1); }
  let k = 0;
  while (out.length < 3) out.push(pickMission(seed + k++, out, want.shift() ?? 0));
  return out;
}

/** Applique une partie aux missions ; renvoie les missions accomplies (remplacées par de nouvelles). */
export function applyRun(missions: Mission[], s: RunStats, seed: number, counter = 0): { missions: Mission[]; done: Mission[] } {
  const done: Mission[] = [];
  const out: Mission[] = [];
  for (const m of missions) {
    if (m.kind === TUTO_KIND) { done.push({ ...m, progress: m.target }); continue; }
    const t = TEMPLATES.find((x) => x.kind === m.kind);
    if (!t) continue;
    const v = t.get(s);
    const next: Mission = { ...m, progress: t.max ? Math.max(m.progress, v) : m.progress + v };
    if (next.progress >= next.target) done.push({ ...next, progress: next.target });
    else out.push(next);
  }
  return { missions: fillMissions(out, seed, counter + done.length), done };
}
