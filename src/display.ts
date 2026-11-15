// Plein écran : Fullscreen API + verrou paysage quand le navigateur les permet (Android/Chrome, bureau).
// iPhone (Safari) n'offre ni l'un ni l'autre : seul le jeu installé sur l'écran d'accueil s'ouvre sans barre d'adresse.

type Nav = Navigator & { standalone?: boolean; userAgentData?: { platform?: string } };

export function isIPhone(nav: Nav = navigator as Nav): boolean {
  const ua = nav.userAgent || '';
  if (/iPhone|iPod/.test(ua)) return true;
  // iPad en mode « site de bureau » : se déclare Mac mais a un écran tactile ; Safari iPad n'a pas non plus de plein écran
  return /Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
}

/** Ouvert depuis l'écran d'accueil (manifest fullscreen/standalone, ou `navigator.standalone` d'iOS). */
export function isInstalled(): boolean {
  const n = navigator as Nav;
  return n.standalone === true || (window.matchMedia('(display-mode: fullscreen)').matches && !document.fullscreenElement) || // le plein écran de l'API fait aussi matcher display-mode: fullscreen
     window.matchMedia('(display-mode: standalone)').matches;
}

export const fullscreenSupported = (): boolean => typeof document.documentElement.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
export const isFullscreen = (): boolean => document.fullscreenElement !== null;

/** À appeler dans un geste de l'utilisateur (tap). Ne lève jamais : renvoie vrai si le plein écran est actif. */
export async function enterFullscreen(): Promise<boolean> {
  if (!fullscreenSupported() || isInstalled()) return isInstalled();
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    return false;
  }
  try {
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
  } catch {
    /* verrou refusé (navigateur de bureau, iOS) : le message « tourne ton téléphone » prend le relais */
  }
  return true;
}

export async function exitFullscreen(): Promise<void> {
  try {
    screen.orientation?.unlock?.();
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* rien à faire */
  }
}

/** Faut-il proposer « Ajouter à l'écran d'accueil » ? iPhone, dans Safari, pas installé. */
export const needsHomeScreenHint = (): boolean => isIPhone() && !isInstalled();
