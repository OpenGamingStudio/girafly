# Audit de sécurité — Girafly V1 (2026-11-15, Max Code)

Périmètre : tout le dépôt (jeu statique, sans serveur ni compte). Méthode : revue manuelle du code et de la configuration, `npm audit`, vérification des en-têtes sur l'image Docker locale.

| Sujet | Constat | Statut |
|---|---|---|
| Dépendances | `npm audit` : 0 vulnérabilité ; dépendances de développement seulement (aucune dépendance d'exécution) ; `npm ci --ignore-scripts` | OK |
| XSS / injection | Aucun `innerHTML`, `eval`, `document.write` : le DOM est construit avec `createElement` / `textContent`. Les textes viennent du catalogue interne, jamais d'une entrée externe | OK |
| CSP | `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; frame-ancestors 'none'…` en `<meta>` et en en-tête nginx ; aucun style ni script inline (variantes par classes ; le canvas se dessine sans CSS) | OK |
| Réseau | Aucune requête (connect-src 'none'), aucune ressource tierce, police auto-hébergée | OK |
| Stockage | `localStorage` seul (clé `girafly-save`), lecture tolérante : JSON abîmé, types faux, valeurs hors bornes, champs inconnus et stockage indisponible sont absorbés (testé). Aucune donnée personnelle, aucun identifiant | OK |
| Triche | La sauvegarde locale est modifiable par le joueur : sans classement ni monnaie réelle, l'impact est nul. À reconsidérer si un classement arrive (V1.1+) | Accepté |
| Secrets | Aucun secret dans le dépôt | OK |
| En-têtes | HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy no-referrer ; fichiers cachés interdits ; `server_tokens off` | OK |
| Déni de service | Boucle à pas fixe bornée (6 pas par image max), pools de taille fixe, aucune allocation par image | OK |
| Vie privée | Pas de cookie, pas de suivi, pas de compte | OK |
