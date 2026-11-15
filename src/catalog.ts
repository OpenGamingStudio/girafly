// Catalogue : 32 cosmétiques (+ « aucun » pour chapeau et écharpe) et 5 améliorations. Prix en pièces.
export type Slot = 'coat' | 'hat' | 'pack' | 'trail' | 'scarf';
export const SLOTS: Slot[] = ['coat', 'hat', 'pack', 'trail', 'scarf'];
export const SLOT_LABEL: Record<Slot, string> = {
  coat: 'Pelage', hat: 'Chapeau', pack: 'Jetpack', trail: 'Traînée', scarf: 'Écharpe',
};

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  price: number;
  /** Débloqué par le niveau du joueur (puis acheté), ou par un nombre de missions accomplies. */
  level?: number;
  missions?: number;
}

const it = (slot: Slot, id: string, name: string, price: number, extra: Partial<Item> = {}): Item => ({
  id: `${slot}-${id}`, slot, name, price, ...extra,
});

export const ITEMS: Item[] = [
  it('coat', 'classique', 'Classique', 0),
  it('coat', 'zebre', 'Zèbre', 60),
  it('coat', 'leopard', 'Léopard', 90),
  it('coat', 'pois', 'Pois', 120),
  it('coat', 'vache', 'Vache', 150),
  it('coat', 'tigre', 'Tigre', 180, { missions: 3 }),
  it('coat', 'arcenciel', 'Arc-en-ciel', 220, { level: 5 }),
  it('coat', 'nuit', 'Nuit étoilée', 280, { level: 8 }),

  it('hat', 'casquette', 'Casquette', 50),
  it('hat', 'bonnet', 'Bonnet', 80),
  it('hat', 'lunettes', 'Lunettes', 70),
  it('hat', 'cowboy', 'Chapeau de cow-boy', 130),
  it('hat', 'aviateur', "Casque d'aviateur", 150),
  it('hat', 'hautdeforme', 'Haut-de-forme', 190, { level: 3 }),
  it('hat', 'licorne', 'Corne de licorne', 240, { level: 6 }),
  it('hat', 'couronne', 'Couronne', 400, { level: 12 }),

  it('pack', 'standard', 'Sac standard', 0),
  it('pack', 'lait', 'Bidons de lait', 100),
  it('pack', 'fusees', 'Fusées rétro', 120),
  it('pack', 'soda', 'Bouteille de soda', 160),
  it('pack', 'ventilo', 'Ventilateur', 200, { level: 4 }),
  it('pack', 'nuage', 'Nuage', 320, { level: 10 }),

  it('trail', 'fumee', 'Fumée', 0),
  it('trail', 'bulles', 'Bulles', 90),
  it('trail', 'coeurs', 'Cœurs', 80),
  it('trail', 'etoiles', 'Étoiles', 110),
  it('trail', 'notes', 'Notes de musique', 130),
  it('trail', 'confettis', 'Confettis', 160, { missions: 2 }),

  it('scarf', 'rayee', 'Écharpe rayée', 40),
  it('scarf', 'tricot', 'Écharpe tricot', 70),
  it('scarf', 'pois', 'Écharpe à pois', 100, { level: 2 }),
  it('scarf', 'flamme', 'Écharpe flamme', 140, { level: 7 }),
];

export const NONE: Record<Slot, string> = {
  coat: 'coat-classique', hat: 'hat-none', pack: 'pack-standard', trail: 'trail-fumee', scarf: 'scarf-none',
};
export const DEFAULT_LOADOUT: Record<Slot, string> = { ...NONE };

export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id);
export const itemsOf = (slot: Slot): Item[] => ITEMS.filter((i) => i.slot === slot);
export const isFree = (i: Item) => i.price === 0;

export interface Unlockable { level: number; missionsDone: number }
export function unlockText(i: Item): string {
  if (i.level) return `Niveau ${i.level}`;
  if (i.missions) return `${i.missions} missions`;
  return '';
}
export function isUnlocked(i: Item, p: Unlockable): boolean {
  return (!i.level || p.level >= i.level) && (!i.missions || p.missionsDone >= i.missions);
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
