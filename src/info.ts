// Textes des bonus et dangers : un seul endroit pour l'annonce à la prise, la jauge du HUD et le tuto.
import { B_BALLOON, B_MAGNET, B_SHIELD } from './gen';
import { ICONS, IconKey } from './icons';
import { Perks } from './sim';

export interface BonusInfo { kind: number; icon: IconKey; name: string; fx: string; dur: (p: Perks) => string; long: string }

export const BONUSES: BonusInfo[] = [
  { kind: B_SHIELD, icon: 'shield', name: 'Bouclier', fx: 'Protège d’un coup', dur: () => 'jusqu’au prochain choc', long: 'Absorbe un choc, puis disparaît.' },
  { kind: B_MAGNET, icon: 'magnet', name: 'Aimant', fx: 'Attire les pièces', dur: (p) => `${p.magnetDur} s`, long: 'Les pièces autour de Gigi viennent toutes seules.' },
  { kind: B_BALLOON, icon: 'balloon', name: 'Ballon-zèbre', fx: 'Tu flottes ! Contrôle doux', dur: (p) => `${p.balloonDur} s`, long: 'Gigi flotte : maintiens pour monter doucement, relâche pour descendre doucement. Un choc fait éclater le ballon, pas de perte de partie.' },
];
export const bonusInfo = (k: number): BonusInfo | undefined => BONUSES.find((b) => b.kind === k);

export interface DangerInfo { icon: IconKey; name: string; text: string }
export const DANGERS: DangerInfo[] = [
  { icon: 'missile', name: 'Missile', text: 'Une alerte « ! » clignote et sonne 1 s avant : place-toi hors de sa ligne.' },
  { icon: 'laser', name: 'Laser à charge', text: 'Une ligne clignote, puis le tir part : sors de la ligne avant.' },
  { icon: 'sweep', name: 'Laser qui balaye', text: 'Deux barres se referment : passe dans l’ouverture qui se déplace.' },
  { icon: 'acacia', name: 'Acacia électrifié', text: 'Obstacle fixe vert à épines : contourne-le.' },
  { icon: 'drone', name: 'Drone', text: 'Événement : il tire des motifs pendant 15 s. Survis pour gagner des pièces.' },
  { icon: 'meteor', name: 'Pluie de météorites', text: 'Événement : des ombres au sol/ciel annoncent leur chute.' },
  { icon: 'wind', name: 'Tempête de vent', text: 'Événement : le vent te pousse, corrige avec le jetpack.' },
];

export { ICONS };
