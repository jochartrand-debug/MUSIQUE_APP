INTERVALLES – PWA hors ligne (iPhone + Android)

Arborescence :
intervalles-pwa/
  index.html
  styles.css
  app.js
  sw.js
  manifest.webmanifest
  data.json
  favicon.ico
  icons/...

TEST LOCAL (Windows)
1) Ouvrir un terminal dans le dossier intervalles-pwa/
2) Lancer :
   python -m http.server 8000
3) Ouvrir :
   http://localhost:8000

INSTALLATION SUR iPhone (sans App Store)
1) Publier le dossier en HTTPS (GitHub Pages / Cloudflare Pages / Netlify)
2) Sur iPhone : Safari > Partager > Ajouter à l’écran d’accueil
3) L’app s’ouvre en plein écran en mode standalone

COMPORTEMENT
Accueil -> Question aléatoire (sans répétition)
Question -> Réponse
Réponse -> Nouvelle question (sans répétition)
Après toutes les paires -> retour Accueil + reset

INTERFACE
- Aucun titre “Question/Réponse”
- Aucun compteur
- Question: blanc sur noir
- Réponse: noir sur blanc
- Transition douce (fade) entre écrans

ORIENTATION
- Le manifest demande l’orientation portrait. Selon le navigateur / OS, le verrouillage peut être respecté ou non.
