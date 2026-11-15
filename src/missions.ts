import { Rng } from './rng';

export interface RunStats { dist: number; coins: number; grazes: number; bonuses: number; balloons: number }
export interface Mission { kind: string; target: number; progress: number; reward: number }

interface Tpl { kind: string; text: (n: number) => string; targets: number[]; rewards: number[]; max?: boolean; get: (s: RunStats) => number }
export const TEMPLATES: Tpl[] = [
  { kind: 'dist', text: (n) => `Parcourir ${n} m au total`, targets: [600, 1000, 1500], rewards: [40, 70, 110], get: (s) => s.dist },
  { kind: 'coins', text: (n) => `Ramasser ${n} pièces`, targets: [150, 300, 500], rewards: [40, 70, 110], get: (s) => s.coins },
  { kind: 'graze', text: (n) => `Frôler ${n} lasers avec la tête`, targets: [3, 5, 8], rewards: [40, 60, 100], get: (s) => s.grazes },
  { kind: 'best', text: (n) => `Atteindre ${n} m en une partie`, targets: [250, 400, 600], rewards: [40, 70, 120], max: true, get: (s) => s.dist },
  { kind: 'bonus', text: (n) => `Ramasser ${n} bonus`, targets: [3, 5, 8], rewards: [30, 50, 80], get: (s) => s.bonuses },
  { kind: 'balloon', text: (n) => `Voler ${n} fois en Ballon-zèbre`, targets: [1, 2, 3], rewards: [40, 70, 100], get: (s) => s.balloons },
];

export const missionText = (m: Mission): string => (TEMPLATES.find((t) => t.kind === m.kind) ?? TEMPLATES[0]).text(m.target);

/** Tire une mission dont le type n'est pas déjà actif. */
export function pickMission(seed: number, active: Mission[]): Mission {
  const r = new Rng(seed * 7919 + 13);
  const free = TEMPLATES.filter((t) => !active.some((m) => m.kind === t.kind));
  const pool = free.length ? free : TEMPLATES;
  const t = pool[r.int(0, pool.length - 1)];
  const lv = r.int(0, t.targets.length - 1);
  return { kind: t.kind, target: t.targets[lv], progress: 0, reward: t.rewards[lv] };
}

/** Applique une partie aux missions ; renvoie les missions accomplies (remplacées par de nouvelles). */
export function applyRun(missions: Mission[], s: RunStats, seed: number): { missions: Mission[]; done: Mission[] } {
  const done: Mission[] = [];
  const out: Mission[] = [];
  for (const m of missions) {
    const t = TEMPLATES.find((x) => x.kind === m.kind);
    if (!t) continue;
    const v = t.get(s);
    const next: Mission = { ...m, progress: t.max ? Math.max(m.progress, v) : m.progress + v };
    if (next.progress >= next.target) done.push({ ...next, progress: next.target });
    else out.push(next);
  }
  let k = 0;
  while (out.length < 3) out.push(pickMission(seed + k++, out));
  return { missions: out, done };
}

/** Niveau du joueur 1-20 : 40 × n(n-1)/2 points d'expérience pour le niveau n. */
export const xpFor = (level: number) => (40 * (level - 1) * level) / 2;
export const MAX_LEVEL = 20;
export function levelOf(xp: number): number {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpFor(l + 1)) l++;
  return l;
}
export const runXp = (s: RunStats, missionsDone: number) => s.dist + s.coins * 2 + s.grazes * 5 + missionsDone * 100;
