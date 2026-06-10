# assets

L'app gira senza icone personalizzate (Expo usa quelle di default).

Per la build di produzione / App Store, aggiungi qui i tuoi file e referenziali in `app.json`:

- `icon.png` — 1024×1024 px, no trasparenza → `expo.ios.icon`
- `splash.png` — ~1284×2778 px → plugin `expo-splash-screen`
- `adaptive-icon.png` — 1024×1024 px (Android)

Esempio in `app.json`:

```json
"ios": { "icon": "./assets/icon.png" },
"plugins": [
  "expo-router",
  ["expo-splash-screen", { "image": "./assets/splash.png", "backgroundColor": "#000000", "imageWidth": 200 }]
]
```
