// Valeurs de jeu : tout l'équilibrage est ici. Unités « logiques » : la scène fait H de haut, 40 unités = 1 m.
export const H = 360;
export const CEIL = 24; // bas de la bande plafond
export const FLOOR = 336; // haut de la bande sol
export const DT = 1 / 60; // pas de temps fixe
export const UNITS_PER_M = 40;
export const PLAYER_FRAC = 0.26; // position de Gigi à l'écran (part de la largeur)
export const GRAVITY = 980;
export const THRUST = 1700;
export const VY_UP = -340;
export const VY_DOWN = 380;
export const SPEED0 = 220;
export const SPEED_MAX = 400;
export const SEG_LEN = 360;
export const PATH_PAD = 16; // marge de la trajectoire garantie
export const WARN_TIME = 1; // avertissement de missile (s)
export const MISSILE_REL = 330; // vitesse du missile vers la gauche, à l'écran
export const GRAZE_DIST = 12;
export const GRAZE_COINS = 3;
export const POOL = { obs: 56, coins: 220, bonus: 8, missiles: 4, parts: 160 };
export const BALLOON_CAP = 1;
export const LOW_EDGE = 24; // rien d'interactif à moins de 24 px des bords
export const MAX_DPR = 2;

export const PERKS_TABLE = {
  thrust: [1, 1.04, 1.08, 1.11, 1.14, 1.17],
  magnetDur: [6, 7, 8, 9, 10, 11],
  magnetRadius: [90, 105, 120, 135, 150, 165],
  shieldChance: [0.18, 0.24, 0.3, 0.36, 0.42, 0.48],
  balloonDur: [8, 9, 10, 11, 12, 13],
  coinMult: [1, 1.1, 1.2, 1.3, 1.4, 1.5],
};
