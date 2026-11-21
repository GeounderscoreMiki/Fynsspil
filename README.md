# Hvilken fynsk kommune? – geocache-spil

En hjemmeside, der kan ligge på GitHub Pages. Scoreboard og tæller gemmes i gratis Firebase (Firestore).

## 1. Opsæt Firebase (én gang)
1. Gå til https://console.firebase.google.com og opret et projekt (Google Analytics kan slås fra).
2. **Build → Firestore Database → Create database**. Vælg en europæisk placering og start i *production mode*.
3. Fanen **Rules**: indsæt indholdet af `firestore.rules` og tryk **Publish**.
4. **Project settings (tandhjulet) → Your apps → Web (`</>`)**: opret en web-app og kopiér `firebaseConfig`-værdierne ind i `config.js`.
   (Disse nøgler er ikke hemmelige – det er reglerne i trin 3, der beskytter databasen.)

## 2. Din endelige koordinat og svar (skjult for spillerne)
1. Åbn `secret/spil.json` og skriv din koordinat i `finalCoordinate`. Her ligger også ledetråde og facit.
2. Kør `node build.mjs`. Det laver `gamedata.js`, hvor svarene kun er hash, og koordinaten er krypteret.
3. **Upload aldrig mappen `secret/` til GitHub** (`.gitignore` sørger for det, hvis du bruger git). Kør `node build.mjs` igen, hver gang du ændrer noget i `secret/spil.json`.

## 3. Læg det på GitHub Pages
1. Opret et nyt repository på GitHub og upload alle filerne i denne mappe (`index.html`, `app.js`, `municipalities.js`, `gamedata.js`, `config.js`, `style.css`, `firestore.rules`) – men ikke `secret/` og `build.mjs` er valgfri.
2. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.**
3. Efter et minut er spillet online på `https://DITBRUGERNAVN.github.io/REPOSITORYNAVN/`.

## Test lokalt
Kør `python3 -m http.server 8000` i mappen og åbn http://localhost:8000.

## Bemærk
Svar og koordinat kan ikke læses direkte i kildekoden, og koordinaten kan først åbnes, når alle 10 svar er rigtige.
En erfaren programmør kunne dog stadig gætte sig til løsningen ved at afprøve kombinationer, da der ikke er nogen server. Det stopper almindelig snyd, men er ikke 100 % sikkert.
