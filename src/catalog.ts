// Catalogue : 20 cosmétiques (équilibrage de Nora §7 : 5 pelages, 5 têtes, 4 jetpacks, 3 traînées, 3 écharpes) et 5 améliorations. Prix en pièces.
export type Slot = 'coat' | 'hat' | 'pack' | 'trail' | 'scarf';
export const SLOTS: Slot[] = ['coat', 'hat', 'pack', 'trail', 'scarf'];
export const SLOT_LABEL: Record<Slot, string> = {
  coat: 'Pelage', hat: 'Tête', pack: 'Jetpack', trail: 'Traînée', scarf: 'Écharpe',
};

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  /** Prix en pièces ; 0 = gratuit ou offert par le compteur de missions. */
  price: number;
  /** Offert quand le compteur de missions accomplies atteint ce nombre. */
  missions?: number;
}

const it = (id: string, slot: Slot, name: string, price: number, missions?: number): Item => ({ id, slot, name, price, missions });

export const ITEMS: Item[] = [
  it('coat-classic', 'coat', 'Classique', 0),
  it('coat-zebra', 'coat', 'Zèbre', 150),
  it('coat-dots', 'coat', 'Pois', 0, 5),
  it('coat-stars', 'coat', 'Nuit étoilée', 0, 19),
  it('coat-harlequin', 'coat', 'Arlequin', 450),

  it('head-goggles', 'hat', "Lunettes d'aviatrice", 0, 1),
  it('head-cap', 'hat', 'Casquette à l’envers', 100),
  it('head-beanie', 'hat', 'Bonnet à pompon', 250),
  it('head-propeller', 'hat', 'Hélice de casquette', 0, 10),
  it('head-crown', 'hat', 'Couronne', 0, 25),

  it('pack-retro', 'pack', 'Fusées rétro', 0),
  it('pack-milk', 'pack', 'Bidons de lait', 200),
  it('pack-soda', 'pack', 'Bouteilles de soda', 0, 7),
  it('pack-teapot', 'pack', 'Théière', 600),

  it('trail-smoke', 'trail', 'Fumée', 0),
  it('trail-stars', 'trail', 'Étoiles', 0, 3),
  it('trail-hearts', 'trail', 'Cœurs', 300),

  it('scarf-stripes', 'scarf', 'Rayée', 0),
  it('scarf-aviator', 'scarf', 'Aviatrice', 0, 14),
  it('scarf-knit', 'scarf', 'Tricot à pompons', 400),
];

export const NONE: Record<Slot, string> = {
  coat: 'coat-classic', hat: 'head-none', pack: 'pack-retro', trail: 'trail-smoke', scarf: 'scarf-stripes',
};
export const DEFAULT_LOADOUT: Record<Slot, string> = { ...NONE };

export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id);
export const itemsOf = (slot: Slot): Item[] => ITEMS.filter((i) => i.slot === slot);
export const isFree = (i: Item) => i.price === 0 && !i.missions;

export interface Unlockable { missionsDone: number }
/** Texte de verrou : « 12 missions » ; le prix est affiché à part. */
export function unlockText(i: Item): string {
  return i.missions ? `${i.missions} mission${i.missions > 1 ? 's' : ''}` : '';
}
export function isUnlocked(i: Item, p: Unlockable): boolean {
  return !i.missions || p.missionsDone >= i.missions;
}
/** Ids des objets gratuits ou offerts par les missions pour ce compteur. */
export function freeIds(missionsDone: number): string[] {
  return ITEMS.filter((i) => i.price === 0 && isUnlocked(i, { missionsDone })).map((i) => i.id);
}

export type UpKey = 'jetpack' | 'magnet' | 'shield' | 'balloon' | 'mult';
export interface Upgrade { key: UpKey; name: string; desc: string; costs: number[]; effect: (lv: number) => string }
export const UPGRADES: Upgrade[] = [
  { key: 'jetpack', name: 'Jetpack', desc: 'Poussée plus réactive.', costs: [100, 220, 400, 700, 1100], effect: (l) => `Poussée +${[0, 4, 8, 11, 14, 17][l]} %` },
  { key: 'magnet', name: 'Aimant', desc: 'Dure plus longtemps, attire de plus loin.', costs: [90, 200, 360, 620, 1000], effect: (l) => `${[6, 7, 8, 9, 10, 11][l]} s, rayon ${[90, 105, 120, 135, 150, 165][l]}` },
  { key: 'shield', name: 'Bouclier', desc: 'Apparaît plus souvent ; au niveau 5, tu démarres avec.', costs: [110, 240, 430, 750, 1200], effect: (l) => `Apparition ${[18, 24, 30, 36, 42, 48][l]} %${l >= 5 ? ', bouclier de départ' : ''}` },
  { key: 'balloon', name: 'Ballon-zèbre', desc: 'Vole plus longtemps.', costs: [100, 220, 400, 700, 1100], effect: (l) => `${[8, 9, 10, 11, 12, 13][l]} s` },
  { key: 'mult', name: 'Multiplicateur', desc: 'Plus de pièces par partie.', costs: [150, 320, 560, 900, 1500], effect: (l) => `x${[1, 1.1, 1.2, 1.3, 1.4, 1.5][l]}`.replace('.', ',') },
];
