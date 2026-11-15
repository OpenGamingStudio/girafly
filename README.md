# Girafly

Un runner à jetpack, jouable dans le navigateur et sur mobile (en paysage). **Gigi la girafe** vole entre barres laser, missiles et branches d'acacia électrifiées. Son long cou est son atout : seuls le corps et la tête comptent pour les collisions, et **frôler un laser avec la tête** rapporte des pièces bonus.

Jeu en ligne : https://girafly.opengamingstudio.com — un jeu [OpenGamingStudio](https://opengamingstudio.com), open source (licence MIT).

## Jouer

- **Maintenir** l'écran (ou la souris, ou Espace / flèche haut) : le jetpack te fait monter. **Relâcher** : tu descends.
- Échap ou P : pause. La pause est automatique quand l'onglet perd le focus ou quand le téléphone passe en portrait (écran « Tourne ton téléphone »).
- Ramasse les pièces et les bonus : bouclier (1 coup), aimant, Ballon-zèbre (vol stable, 1 coup).
- Difficulté (V2) : vitesse +5 % toutes les 20 s (plafond ×1,8), rampe d’accueil de 15 s sans danger tiré, un « director » qui choisit des patterns selon la difficulté (scatter, couloir, zigzag, porte mobile) sans jamais fermer la trajectoire garantie, dangers annoncés (missile seul ou en salve, laser à charge, laser à balayage avec ouverture sûre) et un événement toutes les 60 à 90 s (drone qui tire, pluie de météorites, tempête de vent ; 15 s, +30 pièces si survécu).
- Boutique : 5 améliorations à 5 niveaux (jetpack, aimant, bouclier, Ballon-zèbre, multiplicateur de pièces) et 20 cosmétiques (5 pelages, 5 têtes, 4 jetpacks, 3 traînées, 3 écharpes ; certains offerts par le compteur de missions). Une mission tuto (validée à la fin de la 1re partie, +50 pièces), puis 3 missions actives dont la difficulté suit le compteur de missions accomplies (paliers à 3 et 8) ; ce compteur, affiché sur l’écran d’accueil, offre 8 cosmétiques. Pas de niveau ni d’XP.
- Aucune publicité, aucun achat réel, aucun compte : tout est sauvegardé dans le navigateur (`localStorage`, versionné).

## Développer

```sh
npm ci
npm run dev        # http://localhost:5173
npm test           # tests unitaires (vitest)
npm run build      # typecheck + build statique dans dist/
```

Node 20 ou plus. Pile : Vite, TypeScript, Tailwind CSS v4, Canvas 2D ; police Fredoka auto-hébergée (SIL OFL, `src/fonts/OFL.txt`). Aucune ressource externe, aucune image : tout le dessin (Gigi, cosmétiques, décors) est fait en Canvas.

### Organisation

| Fichier | Rôle |
|---|---|
| `src/config.ts` | tout l'équilibrage (gravité, poussée, vitesses, pools, tables d'améliorations) |
| `src/sim.ts` | simulation à pas fixe de 1/60 s, pools préalloués (aucune allocation par image) |
| `src/gen.ts` | générateur de segments avec **trajectoire garantie** : un chemin libre existe toujours (testé) |
| `src/geom.ts` | obstacles en capsules, hitbox corps + tête (cou exclu) |
| `src/art.ts`, `src/render.ts` | dessin Canvas (DPR plafonné à 2) |
| `src/catalog.ts`, `src/missions.ts`, `src/save.ts` | cosmétiques, améliorations, missions, sauvegarde tolérante |
| `e2e/check.mjs` | contrôle Chrome : 4 tailles (568×320 à 1440), portrait, pause auto, cibles ≥ 44 px, marges de 24 px |

### Déploiement

`Dockerfile` à la racine : build Node 20 puis nginx statique avec en-têtes de sécurité (CSP stricte, sans style inline).

## Pas encore (V1.1+)

Lasers rotatifs, autres véhicules, boss, événements, défis quotidiens, mode hors ligne (PWA), classement.

## Licence

MIT — voir `LICENSE`. La police Fredoka est sous licence SIL OFL 1.1.
