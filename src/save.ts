import { DEFAULT_LOADOUT, SLOTS, freeIds, Slot, UpKey, UPGRADES, itemById } from './catalog';
import { Mission, TEMPLATES, pickMission } from './missions';

export const SAVE_KEY = 'girafly-save';
export const SAVE_VERSION = 1;

export interface Options { reduceMotion: boolean | null; sound: boolean; volume: number }
export interface Save {
  v: number;
  coins: number;
  totalCoins: number;
  games: number;
  bestDist: number;
  totalDist: number;
  grazes: number;
  xp: number;
  missionsDone: number;
  missionSeed: number;
  missions: Mission[];
  owned: string[];
  equipped: Record<Slot, string>;
  upgrades: Record<UpKey, number>;
  options: Options;
  seenHelp: boolean;
}

const num = (v: unknown, d = 0, max = 1e9): number => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : d);

export function defaultSave(): Save {
  const s: Save = {
    v: SAVE_VERSION, coins: 0, totalCoins: 0, games: 0, bestDist: 0, totalDist: 0, grazes: 0, xp: 0, missionsDone: 0,
    missionSeed: 1, missions: [], owned: freeIds(0),
    equipped: { ...DEFAULT_LOADOUT },
    upgrades: { jetpack: 0, magnet: 0, shield: 0, balloon: 0, mult: 0 },
    options: { reduceMotion: null, sound: true, volume: 0.8 },
    seenHelp: false,
  };
  for (let i = 0; i < 3; i++) s.missions.push(pickMission(s.missionSeed++, s.missions));
  return s;
}

/** Lecture tolérante : valeur inconnue, absente ou abîmée -> valeur par défaut ; une sauvegarde plus récente est gardée telle quelle autant que possible. */
export function migrate(raw: unknown): Save {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const s = d;
  s.coins = num(r.coins); s.totalCoins = num(r.totalCoins, s.coins); s.games = num(r.games);
  s.bestDist = num(r.bestDist); s.totalDist = num(r.totalDist); s.grazes = num(r.grazes);
  s.xp = num(r.xp); s.missionsDone = num(r.missionsDone); s.missionSeed = num(r.missionSeed, 1, 1e6);
  s.seenHelp = r.seenHelp === true;
  if (Array.isArray(r.owned)) {
    const ids = r.owned.filter((x): x is string => typeof x === 'string' && !!itemById(x));
    s.owned = Array.from(new Set([...s.owned, ...ids]));
  }
  s.owned = Array.from(new Set([...s.owned, ...freeIds(s.missionsDone)]));
  if (r.equipped && typeof r.equipped === 'object') {
    const e = r.equipped as Record<string, unknown>;
    for (const sl of SLOTS) {
      const id = e[sl];
      if (typeof id === 'string' && (s.owned.includes(id) || id === DEFAULT_LOADOUT[sl])) {
        const item = itemById(id);
        if (id === DEFAULT_LOADOUT[sl] || (item && item.slot === sl)) s.equipped[sl] = id;
      }
    }
  }
  if (r.upgrades && typeof r.upgrades === 'object') {
    const u = r.upgrades as Record<string, unknown>;
    for (const up of UPGRADES) s.upgrades[up.key] = num(u[up.key], 0, 5);
  }
  if (r.options && typeof r.options === 'object') {
    const o = r.options as Record<string, unknown>;
    s.options.reduceMotion = typeof o.reduceMotion === 'boolean' ? o.reduceMotion : null;
    s.options.sound = o.sound !== false;
    s.options.volume = typeof o.volume === 'number' && isFinite(o.volume) ? Math.max(0, Math.min(1, o.volume)) : 0.8;
  }
  if (Array.isArray(r.missions)) {
    const ms: Mission[] = [];
    for (const m of r.missions) {
      if (!m || typeof m !== 'object') continue;
      const x = m as Record<string, unknown>;
      if (typeof x.kind !== 'string' || !TEMPLATES.some((t) => t.kind === x.kind)) continue;
      const target = num(x.target);
      if (target <= 0 || ms.some((q) => q.kind === x.kind)) continue;
      ms.push({ kind: x.kind, target, progress: Math.min(num(x.progress), target - 1), reward: num(x.reward, 40) });
      if (ms.length === 3) break;
    }
    if (ms.length) {
      s.missions = ms;
      while (s.missions.length < 3) s.missions.push(pickMission(s.missionSeed++, s.missions));
    }
  }
  s.v = SAVE_VERSION;
  return s;
}

export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function load(store: Store | null): Save {
  try {
    const t = store?.getItem(SAVE_KEY);
    if (t) return migrate(JSON.parse(t));
  } catch {
    /* stockage indisponible ou JSON abîmé : on repart d'une sauvegarde neuve */
  }
  return defaultSave();
}

export function persist(store: Store | null, s: Save): void {
  try {
    store?.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* navigation privée / quota : la partie continue sans sauvegarde */
  }
}

export function localStore(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
