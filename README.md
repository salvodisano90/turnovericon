# TURNOVER — Coordinatore infermieristico digitale · App iOS nativa (Expo SDK 54 · React 19 · React Native 0.81 · Expo Router 6)

Pianificatore turni infermieri con motore "AI" deterministico (massima copertura),
riposo 11h CCNL art. 26 inviolabile, deroghe segnalate, dark mode professionale,
persistenza offline (AsyncStorage), navigazione nativa (Expo Router).

100% nativo: nessuna WebView, nessun HTML renderizzato, nessun iframe. Tutta la UI e' in
componenti React Native, tutto lo stile in StyleSheet.

## Stack (Expo SDK 54)
- expo ~54 · react 19.1 · react-native 0.81.4 · expo-router ~6
- react-native-reanimated ~4.1 + react-native-worklets (richiesto da Reanimated 4)
- react-native-gesture-handler ~2.28 · react-native-screens ~4.16 · react-native-safe-area-context ~5.6
- @react-native-async-storage/async-storage 2.2 · expo-print ~15 · expo-sharing ~14
- New Architecture OBBLIGATORIA (newArchEnabled: true) — necessaria per Reanimated 4
- Babel: il plugin worklets e' "react-native-worklets/plugin" (NON piu' "react-native-reanimated/plugin")

## Verifica obbligatoria (da eseguire su macchina con rete)
Questi comandi richiedono internet e vanno lanciati da te. "expo install --fix" riallinea
automaticamente ogni versione all'SDK 54 (e' cio' che elimina gli ERESOLVE):

    cd turnover
    npm install                 # 0 conflitti attesi (set versioni SDK 54)
    npx expo install --fix      # pinning autoritativo delle versioni native all'SDK
    npx expo-doctor             # atteso: 0 problemi
    npx expo start              # premi i = simulatore iOS, oppure scansiona il QR

Se expo-doctor segnala una versione, "npx expo install --fix" la corregge da sola.

## Avvio in sviluppo
    npx expo start            # i = simulatore iOS | r = reload | QR per iPhone
    npx expo start --tunnel   # se la rete blocca la LAN

## Test su iPhone con Expo Go
1. Installa Expo Go (SDK 54) dall'App Store.
2. iPhone e computer sulla stessa Wi-Fi.
3. npx expo start -> inquadra il QR con la fotocamera o da Expo Go.
4. Rete ostile -> --tunnel. Tutti i moduli nativi usati sono inclusi in Expo Go SDK 54.

## Build .ipa (cloud, EAS)
    npm i -g eas-cli
    eas login
    eas build:configure
    eas build -p ios --profile preview      # .app simulatore (gratis)
    eas build -p ios --profile production   # .ipa firmata (serve Apple Developer)

## Pubblicazione App Store + TestFlight
    eas submit -p ios --latest
App Store Connect -> TestFlight -> Internal (fino a 100 tester, no review) /
External (gruppo + link, con beta review). Bundle id com.turnover.app.

## Struttura
    app/            Rotte Expo Router (tabs + modali)
    components/     UI nativa riutilizzabile (14)
    screens/        Schermate (10)
    services/       engine.ts (AI), storage.ts (AsyncStorage), pdf.ts (expo-print)
    hooks/          useStore (stato+motore), useTheme, useToast
    utils/          constants, helpers, theme
    types/          tipi TypeScript del dominio

## Note d'uso
- L'app parte VUOTA: crea un Reparto -> aggiungi Personale -> l'AI genera/copre i turni.
- Pulsante AI = Rigenera piano ottimale. Riposo < 11h e' VIETATO (regola dura);
  straordinari/notti extra/giorni consecutivi sono permessi ma marcati come deroghe.
- Tema scuro di default; commutabile in Report -> luna/sole. Tutto persiste offline.
