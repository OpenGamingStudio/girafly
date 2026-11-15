// Pictos en aplats (viewBox 24) pour le HUD, le tuto et la boutique. Chaînes statiques : jamais de texte du joueur.
const I = '#16110F';
const wrap = (body: string) => `<svg viewBox="0 0 24 24" class="h-8 w-8 shrink-0" aria-hidden="true" focusable="false">${body}</svg>`;

export type IconKey = 'shield' | 'magnet' | 'balloon' | 'missile' | 'laser' | 'sweep' | 'drone' | 'meteor' | 'wind' | 'acacia' | 'coin';

export const ICONS: Record<IconKey, string> = {
  shield: wrap(`<path d="M4 4h16v8c0 5-4 7.5-8 9-4-1.5-8-4-8-9z" fill="#3b82f6" stroke="${I}" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 8v8" stroke="#fff6e0" stroke-width="2.4" stroke-linecap="round"/>`),
  magnet: wrap(`<path d="M5 20v-8a7 7 0 0 1 14 0v8" fill="none" stroke="${I}" stroke-width="7" stroke-linecap="butt"/><path d="M5 20v-8a7 7 0 0 1 14 0v8" fill="none" stroke="#ff3d5a" stroke-width="3.4" stroke-linecap="butt"/><path d="M1.5 18.5h7v3.5h-7zM15.5 18.5h7v3.5h-7z" fill="#fff6e0" stroke="${I}" stroke-width="1.8"/>`),
  balloon: wrap(`<path d="M9 17l3 4 3-4" fill="none" stroke="${I}" stroke-width="2" stroke-linejoin="round"/><ellipse cx="12" cy="9.5" rx="7.5" ry="8" fill="#fff6e0" stroke="${I}" stroke-width="2.4"/><path d="M5.2 7.5h13.6M4.8 11.5h14.4" stroke="${I}" stroke-width="2.4"/>`),
  missile: wrap(`<path d="M2 8l5 4-5 4z" fill="#ffc43d" stroke="${I}" stroke-width="2" stroke-linejoin="round"/><path d="M6 8h10l5 4-5 4H6z" fill="#ff3d5a" stroke="${I}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="14" cy="12" r="1.6" fill="#fff6e0"/>`),
  laser: wrap(`<rect x="1.5" y="9" width="21" height="6" rx="3" fill="#ff3d5a" stroke="${I}" stroke-width="2.4"/><path d="M6 12l2-2 2 2-2 2zM14 12l2-2 2 2-2 2z" fill="#fff6e0"/>`),
  sweep: wrap(`<rect x="1.5" y="2" width="21" height="4.5" rx="2.2" fill="#ff3d5a" stroke="${I}" stroke-width="2"/><rect x="1.5" y="17.5" width="21" height="4.5" rx="2.2" fill="#ff3d5a" stroke="${I}" stroke-width="2"/><path d="M12 8.5v7m-3-3l3 3 3-3" fill="none" stroke="${I}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`),
  drone: wrap(`<rect x="6" y="9" width="12" height="7" rx="3" fill="#8b7bd8" stroke="${I}" stroke-width="2.4"/><path d="M3 6h7M14 6h7M6.5 6v3M17.5 6v3" stroke="${I}" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12.5" r="1.8" fill="#ffc43d"/>`),
  meteor: wrap(`<path d="M2 3l9 4M2 9l7 3" stroke="#ffc43d" stroke-width="2.6" stroke-linecap="round"/><circle cx="15" cy="14" r="6.5" fill="#ff8a3d" stroke="${I}" stroke-width="2.4"/><circle cx="13" cy="12.5" r="1.4" fill="${I}"/><circle cx="17" cy="16" r="1" fill="${I}"/>`),
  wind: wrap(`<path d="M2 8h11a3 3 0 1 0-3-3M2 13h16a3 3 0 1 1-3 3M2 18h8" fill="none" stroke="${I}" stroke-width="2.4" stroke-linecap="round"/>`),
  acacia: wrap(`<path d="M12 21v-9" stroke="${I}" stroke-width="3" stroke-linecap="round"/><path d="M3 10c1-5 17-5 18 0-4 2-14 2-18 0z" fill="#2fa35b" stroke="${I}" stroke-width="2.2" stroke-linejoin="round"/><path d="M7 5l1 2M12 3v2M17 5l-1 2" stroke="${I}" stroke-width="2" stroke-linecap="round"/>`),
  coin: wrap(`<circle cx="12" cy="12" r="9.5" fill="#ffc928" stroke="${I}" stroke-width="2.4"/><ellipse cx="12" cy="12" rx="3.2" ry="5" fill="none" stroke="#c98a00" stroke-width="2"/>`),
};

/** Insère un picto dans `el` (la chaîne vient de ICONS, jamais d'une saisie). */
export function putIcon(el: HTMLElement, k: IconKey): void {
  el.insertAdjacentHTML('afterbegin', ICONS[k]);
}
