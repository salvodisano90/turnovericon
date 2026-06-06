# Changelog — TURNOVER

## [Audit navigazione + Matrice personalizzata stagionale]

### Audit navigazione / chiusura (statico, schermata per schermata)
- Verificate tutte le 16 schermate con `SheetHeader`: ciascuna passa `onClose={() => router.back()}` → la X chiude davvero. Assistente e Richieste hanno una X dedicata (router.back). Le 5 schede (Turni/Copertura/Staff/Reparti/Report) correttamente senza X.
- 18 route modali registrate ↔ 18 file presenti: nessuna route mancante. Tutte raggiungibili (incluse ferie-wizard, cell-editor, staff-detail, sostituzioni aperte con `router.push({ pathname, params })`).
- ErrorBoundary presente e attivo in `_layout` (nessuno schermo bianco al crash di render). Toast con auto-dismiss (nessun overlay permanente).
- Esito: nessun pulsante X non funzionante, nessuna schermata irraggiungibile o senza ritorno, nessun blocco individuato.

### Matrice personalizzata stagionale (Obiettivo 4)
- In "Matrici stagionali", accanto ai cicli standard, nuova opzione **+ Personalizzata** per ogni stagione: apre un editor con palette M / P / N / SM / R, sequenza con **aggiungi, elimina, riordina** (◀▶), salva. La matrice creata è salvata in persistenza (`matriciCustom`) e assegnata alla stagione; vale per Primavera/Estate/Autunno/Inverno.

### Verifiche
- Nuova suite `custmat`: la matrice personalizzata genera in tutte le 4 stagioni con **0 violazioni** sacre, deterministica, smonto "S" solo dopo notte. 32/32 suite verdi. Sintassi 92 file 0 errori, import↔export OK, TS2304 = 0.

## [Pre-release: login OTP, conflitti, audit, performance]

### Login reale (FASE 1)
- Adapter Supabase completato: coordinatore email+password; staff/capoturno **OTP a due passi** (`requestStaffOtp` invia il codice solo se l'email è autorizzata e attiva → `verifyStaffOtp` verifica e accede, nessuna password); `changePassword` e `resetPassword`. Schermata Login aggiornata: invio codice, inserimento OTP, reinvio, "password dimenticata". (Statico: richiede backend reale per l'esecuzione.)

### Risoluzione conflitti (FASE 3) — testato
- `services/sync.ts`: `detectConflicts` (locale vs remoto sullo stesso bersaglio con valori diversi), `resolveConflict('local'|'remote')` (Versione A / Versione B), `nonConflicting` (applicazione automatica del resto), `targetKey`. Strategia esplicita, nessun falso positivo a parità di valore.

### Audit trail (FASE 4)
- `AuditEntry` esteso con **actor** (ruolo/utente) e **motivo**. `commit` registra l'attore; rifiuto/approvazione ferie loggano il commento, le correzioni AI loggano la soluzione applicata.

### Verifiche (realmente eseguite in Node)
- **FASE 2 sync**: modifiche eterogenee offline (turno/ferie/reparto) → flush → 3 inviate, **nessuna perdita, nessuna duplicazione** (doppio flush = 0), offline preserva la coda, riconnessione invia il residuo.
- **FASE 3 conflitti**: 1 conflitto rilevato su cella condivisa, A/B esposte, scelta applicata, resto auto-applicato, nessun falso positivo.
- **FASE 6 performance (200 operatori × 20 reparti × 24 mesi)**: generazione **media 186 ms/mese**, picco 521 ms, totale 4,46 s; dashboard 127 ms; centro criticità 161 ms; auto-fix 84 ms; assistente 31 ms.
- 30/30 suite engine verdi; sintassi 91 file 0 errori; import↔export OK; TS2304 = 0.

### Non eseguibile in ambiente offline
- Login/sync end-to-end reali, QA su dispositivi fisici, build APK/AAB/IPA: forniti come codice/guida, NON dichiarati testati.

## [Collegamento Supabase: glue offline-first + login]

### Wiring offline-first (build-safe)
- `services/syncBootstrap.ts`: istanzia Outbox + SyncEngine su AsyncStorage; `recordChange(entity,action,payload)` (best-effort, non blocca offline), `configureSync(port)` per collegare il backend reale, `trySync()` per il flush alla riconnessione.
- Store: `recordChange` collegato a submitRequest/approveRequest/rejectRequest/setCell → ogni modifica entra nella coda di sincronizzazione (offline inclusa).

### Login
- `screens/LoginScreen.tsx` (route `/login`, voce "Account / Accesso" in Strumenti): tab Coordinatore (email+password) e Staff/Capoturno (sola email). Collegata a `backend.auth`: con i placeholder mostra "Backend non collegato"; diventa reale iniettando l'adapter Supabase.

### Guida
- Consegnata `TURNOVER-Setup-Supabase.md`: creazione progetto, esecuzione schema+RLS, credenziali, auth email/OTP, bootstrap client, collegamento login+sync, checklist di test. Indicate onestamente le aggiunte UI residue (OTP staff a due passi, org_id post-login) e ciò che non è eseguibile offline.

### Verifiche
- 30/30 suite engine + suite `sync` verdi. Sintassi 91 file 0 errori, import↔export OK, TS2304 = 0. Il glue di sync è build-safe; backend reale e login restano non eseguibili in ambiente offline.

## [Produzione: fondazione offline-first + adapter Supabase]

### Offline-first (testato)
- `services/sync.ts`: coda **Outbox** + **SyncEngine** provider-agnostici. Le modifiche locali si accodano e si sincronizzano appena c'è rete (flush differito); offline il lavoro continua e la coda persiste. Gestione di ack parziali e conflitti last-write-wins (per `ts`). `RemotePort` è l'interfaccia che il backend reale implementa; `localPort` è il default offline.

### Adapter Supabase (statico, da installare/configurare)
- `services/supabaseBackend.ts`: implementazioni REALI di `AuthService`/`MembershipService`/`RemotePort` su Supabase. Build-safe: riceve il client come parametro (nessun import dell'SDK), quindi il progetto compila anche senza il pacchetto. OWNER login email+password; STAFF/CAPOTURNO accesso solo-email autorizzata (OTP, nessuna password); gestione membership e push outbox.
- `integrations/supabase-schema.sql`: schema Postgres + **Row Level Security** (organizations, memberships, requests, sync_ops, app_state) con policy OWNER/STAFF/CAPOTURNO e commento di rifiuto riservato al richiedente.

### Stato
- Questi pezzi NON sono eseguibili nell'ambiente offline (servono rete, SDK, credenziali). Forniti come codice reale + schema, marcati come non testati a runtime. La fondazione offline-first è invece testata in Node.

### Verifiche
- 30/30 suite engine verdi + nuova suite `sync` (Outbox/SyncEngine). Sintassi 88 file 0 errori, import↔export OK, TS2304 = 0.

## [Correzione automatica + Previsione + Hardening]

### Correzione automatica delle criticità
- `proposeAutoFix(ctx, piano, day?)` → fino a 3 soluzioni ordinate per efficacia: **richiamo da riposo** (validato con evalCandidate → solo se legale), **spostamento interno** (riassegnazione settore, nessun cambio turno), **chiusura postazione** (ultima risorsa). Ogni soluzione riporta impatto copertura (prima→dopo), impatto equità/fatigue/economico (nullo/basso/medio/alto) e rischio legale (assente/attenzione/critico). Le soluzioni non violano mai 11h/recupero/smonto/max-consecutivi/esenzioni.
- `applyAutoFix(ctx, piano, sol)` → applica richiamo/spostamento al piano (clone, non muta l'originale). Store: azione `applyFix(sol)` con undo/audit; per la chiusura agisce sul reparto.

### Previsione scoperture
- `forecastCoverage(ctx, piano, horizon, fromDay)` → giorni a rischio (medio/alto) nei prossimi 7/14/30 giorni con motivazioni (assenze approvate, carenza senior, postazioni a rischio).

### Analisi cause
- `whyUncovered` arricchito: «mancano N infermieri/OSS» per ruolo + `causeStrutturali`. `structuralCauses(ctx, piano)` (organico sottodimensionato, assenze concentrate, pochi senior/OSS, notti squilibrate). `repartoFragility(ctx, piano)` (ranking reparti).

### Assistente AI — nuovi intent
- «cosa rischia di scoprirsi», «proponi correzione» / «come aumentare la copertura», «applica correzione», «chi posso richiamare», «cosa manca oggi», «quale reparto è più fragile», «quale matrice genera più criticità». Tutti su dati reali.

### UI
- Nuova schermata **Centro Criticità** (perché scoperto + proposte di correzione con «Applica» + previsione 7/14/30). Sezione **Criticità future** + pulsanti Centro/Simulatore nella Dashboard.

### Hardening backend (placeholder offline)
- `services/backend.ts`: interfacce `AuthService`, `SyncService`, `MembershipService` con implementazioni locali placeholder (nessuna rete; non rompono l'offline). Pronte da collegare a Supabase/Firebase.

### Verifiche
- 30/30 suite verdi (nuova `autofix`). `applyAutoFix`: **0 violazioni sacre** dopo l'applicazione. L'AI usa solo nomi reali. Sintassi 86 file 0 errori, import↔export OK, TS2304 = 0.

## [Solo dati reali — nessun operatore di esempio]

### Nessun dato demo
- Confermato: lo stato iniziale è vuoto (nessun operatore, reparto o ferie predefiniti). Nessun seed/demo nel database. I `REPARTI_PREDEF` restano solo come *template* selezionabili in fase di creazione (nulla viene inserito finché il coordinatore non agisce).
- Rimosso il nome di esempio dal placeholder di inserimento operatore.

### Assistente AI su dati reali
- Tutte le analisi AI usano esclusivamente `ctx.staff`, `ctx.ferie`, `ctx.richieste`, `ctx.reparti` e le postazioni reali; nessun nome inventato. I nomi sintetici delle simulazioni («Nuovo operatore», «Agg N») non compaiono mai nelle risposte.
- Nuovo intent «Perché oggi sono scoperto?» → `whyUncovered(ctx, piano, day?)`: copertura del giorno, postazioni realmente scoperte, cause (operatori realmente assenti con il motivo reale: ferie/malattia/permesso), soluzioni con soli operatori reali (sostituto idoneo o richiamo da riposo); se nessuno è idoneo, suggerisce un'assunzione.

### Verifiche
- 29/29 suite verdi (nuova `realdata`): l'AI cita solo nomi realmente inseriti; con personale vuoto non inventa nulla; «perché non è pubblicabile» resta sul proprio intent. Sintassi 83 file 0 errori, import↔export OK, TS2304 = 0.

## [Postazioni come vincolo reale di generazione]

### Postazioni nel motore di generazione
- L'ottimizzatore (`optimizePiano`) ora include una **penalità di copertura delle postazioni** nel costo globale, con pesi per priorità (critica ≫ alta > media > bassa). Aggiunto un **pass dedicato** che mira agli scambi che coprono le postazioni critiche/alte scoperte, eseguito **prima** delle passate di equità/preferenze.
- **Sicurezza per costruzione**: ogni scambio passa ancora tutti i controlli legali (riposo 11h, recupero post-notte, smonto ancorato alla notte, max 6 consecutivi, esenzioni di ruolo, quota notti). Le postazioni guidano *quali* scambi legali applicare, non *quali* vincoli rilassare. Senza postazioni configurate il comportamento è identico a prima (zero regressioni).
- Priorità rispettata: legale > critiche > alte > medie > equità > preferenze > desiderata. Una postazione critica non viene sacrificata per una preferenza.

### Copertura minima garantita + CRITICITÀ GRAVE
- `Reparto.minimi` (critiche/alte/OSS/infermieri minimi). `stationGuarantee(ctx, piano)` segnala **CRITICITÀ GRAVE** con dettaglio per giorno quando i minimi non sono rispettati. `publishGate` ora **blocca la pubblicazione** se una postazione critica è scoperta o se i minimi non sono garantiti.

### Dashboard direzionale
- `safetyIndex(ctx, piano)` → indice di sicurezza assistenziale 0-100 (postazioni critiche/alte coperte, presenza senior/OSS, criticità aperte) con livello 🟢 Sicuro / 🟡 Attenzione / 🔴 Critico. Mostrato in cima alla Dashboard.

### Simulatore strategico
- `simulateScenario` ora restituisce anche `indiceSicurezzaPrima/Dopo`, `postazioniRecuperate`, `postazioniPerse`. La schermata mostra questi campi.

### Assistente AI — direzionale
- Nuovi intent: «quale postazione impedisce la pubblicazione», «quali postazioni critiche non sono garantite», «quanti infermieri senior mancano», «quale assunzione migliorerebbe maggiormente la copertura» (confronto senior/OSS/infermiere per indice di sicurezza), «collo di bottiglia», «quale postazione genera più criticità».

### Verifiche (QA sacro)
- 28/28 suite verdi (nuova `clinical_gen`). **Stress matrix con postazioni attive (reparti stagionali + coordinatore + senior/OSS) su 10/30/50/100/200 operatori e mesi a cavallo stagione: 11h=0, recupero=0, smonto=0, max-consecutivi≤6, esenzioni coordinatore=0** — invarianti sacri preservati. Determinismo confermato. Sintassi 83 file 0 errori, import↔export OK, TS2304 = 0.

## [Postazioni operative reali + Copertura assistenziale]

### Postazioni operative (Fasi 1-4)
- Tipi: `Postazione` (id, nome, turni M/P/N, priorità critica/alta/media/bassa, requisiti, quantità), `StationReq` (ruolo infermiere/oss, senior, referente, anzianità minima), stato `verde`/`giallo`/`rosso`. Campo `Reparto.postazioni?`.
- Motore — `stationCoverage(ctx, piano)`: layer di analisi sopra il piano (non tocca il generatore). Per ogni giorno/turno alloca gli operatori presenti alle postazioni con **allocazione greedy per priorità** (prima le critiche). Stato per postazione: 🟢 coperta, 🟡 coperta con criticità (requisito soft come senior/referente soddisfatto in deroga), 🔴 scoperta.
- `stationsOnDay(ctx, piano, day)` per lo stato giornaliero; `substituteForStation(...)` propone un operatore idoneo (preferendo il match completo).
- Requisiti verificati: ruolo (infermiere/OSS), senior (livello/anni≥5/classificazione), referente, anzianità minima.

### Dashboard Clinica (Fase 5)
- `dashboardData` ora include `postazioni` (copertura assistenziale reale) e una criticità dedicata alle postazioni critiche scoperte. La Dashboard mostra la sezione «Copertura Assistenziale Reale» con pallino colore + stato.

### Simulatore clinico (Fase 7)
- `simulateScenario` ora restituisce anche `stazioniScoperte` per il giorno interessato (es. «Se Rossi è assente domani» → quali postazioni restano scoperte).

### AI clinica (Fase 6)
- Nuovi intent: «quali postazioni sono scoperte», «quale postazione è più critica», «quale sostituto copre [postazione]». Trigger ristretto per non collidere con «unità assistenziali».

### Verifiche
- 27/27 suite verdi (nuova `clinical`). Retro-compatibile: reparti senza postazioni → nessun impatto. Sintassi 83 file 0 errori, import↔export OK, TS2304 = 0.

## [Dashboard Coordinatore + Config operativa stagionale + Simulatore AI]

### Configurazione operativa stagionale (Fasi 1-2)
- Tipo `SeasonOps` su `SeasonRange`: settori attivi per turno (M/P/N), OSS per turno (informativo), settori chiusi, posti letto/chiusi, copertura minima %, personale minimo.
- Motore: `resolveSeasonalOps(ctx)` applicato in cima a `buildPiano` e `computeCoverage`. Quando un reparto `STAGIONALE` ha settori specifici per la stagione dominante del mese, generazione e copertura usano quei fabbisogni. **Retro-compatibile**: senza override il contesto resta identico (zero regressioni sulle 25 suite preesistenti). Verificato: giugno→settori estate (15 slot), gennaio→settori inverno (10 slot).

### Simulatore Scenario / Scenario AI (Fasi 4-5)
- `simulateScenario(ctx, piano, input)` → `{ coperturaAttuale, coperturaPrevista, giorniCritici, turniScoperti, impatto, sostituti[], vincoli[], nota }`. Scenari: ferie, malattia, assunzione, dimissione, chiusura/apertura settore, +/- posti letto. **Tutte le simulazioni sono temporanee: il piano reale non viene mai modificato.** Sostituti via `evalCandidate`; vincoli (copertura insufficiente, sbilanciamento notti) calcolati.
- Schermata `SimulatoreScreen` (route `simulatore`).

### Dashboard Coordinatore (Fase 3)
- `dashboardData(ctx, piano, today)` → copertura mese/settimana/oggi (copertura giornaliera reale), conteggi ferie (attesa/approvate/respinte), criticità, indicatori (più notti/weekend/festivi/ore, meno ore), distribuzione per operatore, stagione attiva.
- Schermata `DashboardScreen` (route `dashboard`) con KPI, suggerimenti AI proattivi, criticità, indicatori e grafici a barre.

### AI proattiva (Fase 7)
- `proactiveSuggestions(ctx, piano)` → suggerimenti automatici: approvazione consigliata, giorni scoperti previsti, sbilanciamento notti, mese in equilibrio.

### Assistente AI — nuovi intent (Fase 6)
- Stagione attiva, configurazione operativa attiva, settori chiusi per stagione, «se apro/chiudo un settore» (via simulatore), «quanti operatori mancano per il 100%» (stima da simulazione iterativa), «chi posso assumere per migliorare la copertura».

### Performance (Fase 8)
- Misurata su 10/30/50/100/200 operatori: dashboard 3-20 ms (< 500), scenario 3-26 ms (< 2 s), generazione nei limiti. Tutti i target rispettati.

### Verifiche
- 26/26 suite verdi (nuova `advanced` + tutte le precedenti incl. `stress`, `seasonal`). Sintassi 81 file 0 errori, import↔export OK, TS2304 = 0.

## [Matrici stagionali + valutazione AI richieste]

### Matrici stagionali (nuova modalità "STAGIONALE")
- Tipi: `Season`, `SeasonRange` (matrice + data inizio/fine in gg/mm, mesi 1-based), `SeasonalConfig` (Record delle 4 stagioni). Campo opzionale `seasonal?` su `Reparto` e su `Staff`.
- Helper puri (`utils/helpers.ts`): `inSeasonRange` (con gestione wrap dicembre→febbraio), `seasonForDay`, `seasonalMatrice`.
- Motore (`buildPiano`): risoluzione della matrice **per-giorno** quando il reparto/operatore usa `STAGIONALE`. `seasonalConfigFor` determina la configurazione (operatore > reparto; le preferenze forti solo-mattina/pomeriggio e i combo restano prioritari).
- **Continuità di ciclo (requisito critico):** al cambio stagione il ciclo NON riparte dal primo giorno. L'indicizzazione resta ancorata al **calendario assoluto** (`absDayIndex`), quindi cambia solo la lunghezza del ciclo mentre l'indice continua a scorrere. Verificato: 30/30 divergenze rispetto all'indicizzazione locale (nessun restart), ≤1 differenza da recupero/smonto, smonto e vincolo 11h preservati al confine.
- Date stagioni completamente personalizzabili (nessuna data fissa).

### Assistente AI — domande stagionali
- Nuovi intent: matrici stagionali attive, matrice usata in un mese ("a luglio"), prossimo cambio stagione, operatori che usano matrici stagionali, configurazione stagionale del reparto. Trigger ristretto per non intercettare domande non stagionali (es. "quante ore a giugno").

### Valutazione AI per richiesta + commento obbligatorio (multiutente)
- `assessRequest(ctx, piano, req)` → simula l'assenza del richiedente nei giorni richiesti, misura la **copertura residua** reale, propone un **sostituto idoneo** (via `evalCandidate`), classifica l'**impatto** (basso/medio/critico) e indica se la richiesta è approvabile.
- `RichiesteScreen`: ogni richiesta in attesa mostra la valutazione AI (copertura prima→residua, sostituto, impatto, nota). Il **rifiuto richiede una motivazione** (≥3 caratteri) salvata nello storico e visibile al richiedente.

### UI
- Nuova schermata `SeasonalConfigScreen` (route `matrici-stagionali`, modale) con selettore reparto interno, scelta matrice per stagione (cicli standard + personalizzate) e intervallo date con stepper gg/mm. Voce "Matrici stagionali" in Strumenti.
- Il **costruttore di matrici personalizzate** era già presente in `MatriciScreen` (composizione libera M/P/N/S/R/G, lunghezza arbitraria, salvataggio nel catalogo, eliminazione, persistenza nei backup).

### Persistenza
- `reparto.seasonal` viene salvato/ripristinato automaticamente (i reparti sono serializzati per intero in salvataggio, idratazione e backup); le matrici personalizzate erano già persistite.

### Verifiche
- 25/25 suite verdi (incluse `seasonal`, `seasonal_ai`, `stress`). Sintassi 77 file 0 errori, import↔export OK, TS2304 = 0.

## [CAPOTURNO, coordinatore M/R/F, stress matrix]

### Ruolo CAPOTURNO (terzo ruolo, permessi intermedi)
- `UserRole` += `CAPOTURNO`. RBAC (utils/permissions.ts): CAPOTURNO può **modificare turni**, **approvare/respingere richieste**, **vedere tutti gli operatori**; NON può pubblicare, invitare, modificare personale/reparti, esportare.
- Guardie store ora basate su `can()`: `setCell` consentito a OWNER+CAPOTURNO; `approveRequest`/`rejectRequest` a OWNER+CAPOTURNO. `loadData` gestisce i 3 ruoli. `roleLabel`/`isOwner` aggiornati (isOwner = solo OWNER).
- UI: schermata Richieste con **switch a 3 ruoli** e gating `can()` — composer per STAFF/CAPOTURNO, dashboard approvazioni per chi può approvare (OWNER/CAPOTURNO), gestione accessi solo OWNER.

### Coordinatore: solo M/R/F
- Motore: il coordinatore non riceve mai il pomeriggio (P→R; la notte era già N→R). Verificato anche con matrice piena (DECIMA): ottiene solo M/R.

### Stress matrix (eseguita davvero)
- 10/30/50/100/200 operatori × checkpoint mesi 1/6/12/24, optimize ON, 2 reparti, mix contratti/matrici, neoassunti, OSS, ferie+L104+malattia, continuità cross-mese.
- Risultati: **11h=0, recupero=0, smonto=0, maxRun≤6, coordinatore 0 notti/WE/festivi, 0 settori, solo M/R/F, determinismo ✓** a ogni scala. Copertura: 10→~44% (organico insufficiente, non violazione), 30→~89%, 50→~92%, 100→93%, 200→94%. Tempi 56–301 ms/mese.

### Verifiche
- Suite CAPOTURNO + coordinatore M/R/F verdi. Regressione completa (22 suite) verde. Stress matrix verde. TS2304=0, import/export ok, sintassi 0 errori (75 file).

## [Multiutente — RBAC, richieste/desiderate con approvazione (fondazione lato-app)]

Backend **da collegare in seguito** (scelta utente): qui è costruita la **fondazione lato-app**, locale e testabile, con punto d'innesto pulito. Inviti via email, sync tra dispositivi e autenticazione restano **da implementare sul backend**. Abbonamento **escluso** (scelta utente).

### Dati / tipi
- `UserRole` (OWNER/STAFF), `RbacAction`, `ApprovalRequest`, `Membership`. `EngineContext.richieste?` e `PersistedData` += `role/members/richieste`.

### RBAC (utils/permissions.ts)
- `can(role, action)` e `isOwner(role)`: OWNER permessi completi; STAFF sola consultazione + invio richieste (no modifica turni/personale/reparti, no pubblicazione/approvazione/inviti/export).

### Richieste → vincoli (utils/requests.ts, puro)
- `requestToConstraint`: una richiesta **approvata** diventa una **ferie** (assenza) o un **desiderata** (riposo/mattina/pomeriggio/evitaNotte, priorità alta) → entra automaticamente nei vincoli di generazione. `requestLabel` per la UI.

### Store (hooks/useStore.tsx)
- Stato `role/members/requests` + persistenza (e correzione: ora salva anche `aiMode/matriciCustom/matriceMese`, prima persi).
- Azioni: `setRole` (switch in-app), `inviteMember`/`revokeMember`, `submitRequest`, `approveRequest` (→ converte in vincolo, rigenera), `rejectRequest`.
- **Guardie RBAC**: `setCell` e `approveRequest`/`rejectRequest` bloccati per lo STAFF.
- `ctxOf` espone `richieste` all'assistente.

### Assistente AI (services/engine.ts)
- Nuovi intent: "chi ha richiesto ferie", "quanti operatori in attesa", "mostrami i conflitti/incompatibili", "quale combinazione approvare". Rilevamento conflitti di copertura (approvare lascerebbe giorni scoperti).

### UI
- Nuova schermata **Richieste e Desiderate** (`screens/RichiesteScreen.tsx`, route `app/richieste.tsx`, modale), role-aware: STAFF invia richieste e vede lo stato; OWNER approva/respinge, gestisce gli accessi (invita/revoca) e cambia vista con lo **switch ruolo**. Ingresso da Strumenti.

### Verifiche (motore/logica, reali)
- RBAC `can` (OWNER vs STAFF) verde. `requestToConstraint` (ferie/riposo/preferenze) verde. **Approvazione ferie rispettata in generazione** (operatore assente nei giorni approvati). Intent AI richieste verdi. **Conflitto reale** (troppe ferie lo stesso giorno) rilevato. Regressione completa (20 suite) verde, TS2304=0, import/export ok.

### Scenari richiesti
- ② STAFF tenta modifica turno → **negato** (guardia `setCell` + RBAC). ③ STAFF invia ferie → OWNER approva → **generazione rispetta** (verificato). ④ revoca accesso → membro marcato "revocato" (rimozione reale cross-device = backend). ① inviti gratuiti / ⑤ abbonamento: ① scaffold inviti (accesso reale = backend); ⑤ **escluso** per scelta.

### Da completare (richiede backend / verifica device)
- Inviti via email reali, sincronizzazione multi-dispositivo, autenticazione, rimozione reale all'atto della revoca: **backend** (già esistente lato utente, da collegare). Gating visivo dei pulsanti di modifica su **tutte** le schermate per lo STAFF: enforce già a livello store (setCell) e nella schermata Richieste; estensione visiva completa = follow-up (UI non testabile a runtime offline).

## [Architettura — Coordinatore e Fuori Turno NON sono unità assistenziali]

Correzione concettuale: il personale di **coordinamento/supporto** (Coordinatore, Fuori Turno) è ora **escluso dalla logica assistenziale** (copertura, settori, scoperture, sostituzioni, fabbisogno, bilanciamento, ottimizzazione), pur restando **visibile nel piano**. Il personale **assistenziale** (Infermiere, OSS) resta l'unico a partecipare.

### Dati
- `Staff` + `countInCoverage?: boolean` (override esplicito). Helper unico `countsInCoverage(inf)` (utils/helpers.ts): usa il flag se presente, altrimenti deriva dalla qualifica (Coordinatore/Caposala/Fuori Turno → false; Infermiere/OSS → true). Preservato in `sanitizeStaff`.

### Motore (services/engine.ts)
- `evalCandidate`: ritorna `null` per il personale non assistenziale → **mai** usato per autofill, scoperture o sostituzioni.
- Posa‑matrice (STEP 4): il personale non assistenziale resta visibile col proprio turno ma **senza settore** (settore = null).
- `computeCoverage`: **salta** il personale non assistenziale (la copertura usa solo l'assistenziale).
- `optimizePiano`: opera **solo** sul personale assistenziale (non riassegna né "spreme" coordinatori/fuori turno nei settori). *(Questo era il punto che, con optimize attivo, assegnava erroneamente settori al coordinatore.)*
- `assistantQuery`: nuovo intent **"unità assistenziali"** ("quante unità/infermieri/oss…") → conta solo l'assistenziale ed elenca a parte gli esclusi (Coordinatore, Fuori Turno).
- `services/substitution.ts` `rankSubstitutes`: il personale non assistenziale è **escluso** dalla lista candidati.

### UI
- Personale: la riga marca il personale non assistenziale come **"supporto (fuori conteggio)"** (riga troncata, nessun rischio layout).

### Verifiche (motore, reali)
- **Scenario 1** (1 coord + 30 inf + 10 OSS): coordinatore visibile, **0 settori**, copertura identica con/senza coordinatore (100%↔100%), assente dai sostituti.
- **Scenario 2** (solo coordinatore): **copertura = 0%** (non 100%).
- **Scenario 3** (scoperture): il coordinatore **non** viene mai usato per chiudere buchi (né autofill né sostituti).
- **Scenario 4** (assistente): "unità assistenziali presenti" = 25 (18 inf + 7 OSS), Coordinatore e Fuori Turno elencati come esclusi.
- Helper `countsInCoverage` (incl. flag esplicito) verde. Regressione completa (19 suite) verde, TS2304=0, import/export ok.

### Numeri prima/dopo
- Scenario 2: copertura **prima 100% → dopo 0%** (corretto).
- `scale` (30/50/100): confinamento cross‑reparto ora calcolato sui soli assistenziali (22/37/75 unità) — i coordinatori (25%) non sono più conteggiati nella distribuzione assistenziale.

### Documentato (SAFE MODE, non applicato)
- Separazione visiva del **Report** in sezioni "Assistenziale" / "Supporto": i dati di copertura sono già corretti; il raggruppamento grafico richiede verifica su dispositivo.

## [UI iOS 26 — SAFE MODE STRICT (presentazione, logica invariata)]

Solo layer UI/design system. Nessuna modifica a engine/validator/persistence/storage/AI/export. Applicate solo modifiche a rischio‑zero‑layout, verificate (TS2304=0, import/export, route, test motore verdi).

### Applicate (certe)
- **Design system completato** (Fase 2, additivo, `utils/theme.ts`): aggiunte `SPACING` (4/8/12/16/20/24/32) e `RADIUS` (12/16/20/24), oltre alla scala `TYPE` e `TOUCH_MIN` già introdotte. Adottabili gradualmente, nessuna rottura.
- **Personale — stile "Contatti"** (Fase 5): la riga ora mostra anche il **livello professionale** (classificazione automatica) e gli **anni di esperienza**, riusando dati già nel modello tramite `classifyOperator` (funzione di sola lettura). Modifica limitata alla sottostringa esistente con `numberOfLines={1}` → nessun rischio di overflow/layout. Nessun dato inventato.

### PROPOSTE NON APPLICATE — richiedono verifica dispositivo reale
- **Dashboard‑first** (Fase 3): anteporre KPI/alert/azioni alle liste richiede ristrutturare l'albero dei componenti → verifica layout/scroll su device.
- **Header Large Title + stato operativo** (Fase 4): cambia la configurazione di navigazione/safe‑area → verifica su device.
- **Copertura come dashboard KPI** (Fase 6): ristrutturazione schermata → verifica su device.
- **Assistente "Apple Intelligence" (insight proattivi in evidenza)** (Fase 7): la logica esiste (fatigue, gate, neoassunti, proposte) ed è già esposta nelle sezioni Criticità/Suggerimenti; un pannello insight dedicato è una ristrutturazione UI → verifica su device.
- **FlatList/SectionList** (Fase 9): Personale/Report/Reparti/Matrici/Assistente usano `.map` in `ScrollView`; conversione cambia scroll/misure → verifica su device.


## [UI/UX refactor — SAFE MODE (solo presentazione, logica invariata)]

Nessuna modifica a engine/store/servizi/validatori/persistenza/AI: toccati solo componenti visuali e design system. Applicate solo modifiche a rischio‑zero‑layout, verificate (compilazione, TS2304=0, import/export, route).

### Applicate
- **Feedback "pressed" su tutti i controlli condivisi** (Fase 5 — nessun pulsante "morto"): `Chip`, `SelectChip`, `OptionCard` ora reagiscono al tocco con opacità; `Button` ha già l'animazione di scala. Propagato a tutta l'app tramite i componenti condivisi.
- **Touch target ≥44pt** (Fase 3) senza spostare la grafica: aggiunto `hitSlop` a `Button` (copre la variante `small` 38→48), `Chip` (34→~46), `SelectChip` (~32→~44). Zero rischio di layout (l'area visiva non cambia).
- **Design system tipografico iOS** (Fase 2): aggiunta scala `TYPE` (largeTitle/title1‑3/headline/body/callout/subhead/footnote/caption) e `TOUCH_MIN=44` in `utils/theme.ts`. Additiva: adottabile gradualmente senza rotture.
- Verificato che il sistema colori è già tokenizzato (nessun colore arbitrario significativo: i soli `#000` residui sono default icona e shadow standard).

### Documentate, NON applicate (rischio di regressione non verificabile offline)
- **FlatList/SectionList** al posto di `ScrollView + map` (Fase 6): cambia il comportamento di scroll/misura; va validato su dispositivo.
- **Card translucide + blur + large‑title collapsing header** (Fase 4): richiedono `expo-blur`/configurazione header di navigazione non verificabili qui.
- **FAB / floating entry point dell'assistente** (Fase 7): overlay con safe‑area e z‑index da validare su device; l'ingresso resta il pulsante ✦ in ogni header (Copilot‑style, già non‑chatbot).
- **Celle turno (ShiftGrid)**: dense per design (31 giorni, scroll orizzontale). NON aggiunto `hitSlop` per non creare aree di tocco sovrapposte tra celle adiacenti.


## [Audit pre-produzione — bug CRITICO persistenza + completamento backup + assistente]

### ⚠ BUG CRITICO corretto — perdita dati al caricamento
- **Causa**: `loadData()` applicava `sanitizeStaff` a ogni avvio, e `sanitizeStaff` (utils/helpers.ts) **restituiva solo un sottoinsieme fisso di campi**, scartando `esenteWeekend`, `esenteFestivi`, `preferenze`, `competenze`, `anniEsperienza`, `livello`, `templateCombo`, `oreSettimanali`.
- **Effetto**: dopo qualunque riavvio dell'app, un coordinatore configurato "solo mattina / no notti / no weekend / no festivi" perdeva quelle impostazioni e **ricominciava a ricevere notti, weekend e festivi**; si perdevano anche tutte le preferenze e il profilo professionale.
- **Fix**: `sanitizeStaff` ora **preserva tutti i campi opzionali** (con validazione leggera) mantenendo la normalizzazione difensiva degli array obbligatori. File: `utils/helpers.ts`.
- **Verifica**: nuova regressione dedicata — tutti i campi opzionali sopravvivono al passaggio; array malformati restano normalizzati a `[]`.

### Backup/restore completato (perdita dati al ripristino)
- Prima il backup salvava solo reparti/staff/ferie/pianos/mese/anno/audit: **andavano persi matrici personalizzate, matrice‑mese, desiderata e impostazioni** (modalità, modalità AI).
- `serializeBackup` + `parseBackup` (services/storage.ts) ora includono `matriciCustom`, `matriceMese`, `desiderata`, `mode`, `aiMode`; `exportBackup`/`importBackup` (hooks/useStore.tsx) li esportano e ripristinano. Checksum **retro‑compatibile** (verifica sul payload ricevuto: i vecchi backup restano validi).

### Assistente AI — domande mancanti completate
- Nuovi intenti in `assistantQuery` (services/engine.ts): **elenco per livello** ("chi è neoassunto/junior/senior/esperto/referente"), **straordinari/ore**, e instradamento di **"quali vincoli CCNL sto violando"/"quali criticità"** al gate. Disambiguazione "chi è neoassunto" (elenco) vs "turni con neoassunti" (analisi turni).

### Verifiche eseguite (motore, reali)
- Workflow coordinatore completo (creazione reparto/personale/OSS/coordinatore, ferie/malattia/104, matrice personalizzata, generazione, modifica, trova sostituto, gate, export PDF/XLSX, backup/restore) → verde.
- Assistente: 11 domande di Fase 7 + normativa (Fase 8) → verde.
- Eventi reali (5 malattie + 10 ferie, dimissione, assunzione, apertura/chiusura reparto, coordinatore assente) → vincoli sempre tenuti.
- Stress 10/30/50/100/200 operatori, fino a 20 reparti, 12 mesi: nessun crash, 41–88 ms/mese, 11h=0, recupero=0, max‑6.
- Regressione completa (18 suite) verde; TS2304=0; import/export ok.

### Dichiarato NON correggibile/verificabile in questo ambiente offline
- Esecuzione UI a runtime (tap reali, rendering, scroll, tastiera, orientamento, notch, device iOS/Android/tablet): **non eseguibile** senza dispositivo/Expo.
- UX mobile da rivedere su dispositivo: **target touch < 44px** (es. ScreenHeader 38/30px, CellEditor 30px, badge/azioni 32‑36px) e **liste non virtualizzate** (Personale/Report usano `.map` in ScrollView: con 100‑200 operatori va valutata `FlatList`). Identificati ma **non modificati** per non introdurre regressioni non verificabili offline.


## [Enterprise — Assistente Coordinatore AI offline + profilo professionale]

### Nuove funzioni motore (pure, testate)
- **`assistantQuery(ctx, piano, q)`**: motore di interrogazione **offline** (nessuna API esterna) sui dati reali.
  Intenti: ranking notti/weekend/festivi/assenze, sovraccarico (fatigue), giorni consecutivi, turni scoperti,
  alert neoassunti, motivo del blocco pubblicazione, ricerca sostituti (ordinati per idoneità e livello),
  e **normativa** integrata. Routing robusto (es. "smonto dopo la notte" → normativa, "chi può fare una notte"
  → sostituto, "chi ha più notti" → ranking).
- **`NORMATIVA` + `normaLookup`**: base normativa locale (riposo 11h/D.Lgs 66, smonto/recupero, max consecutivi,
  lavoro notturno, ferie, L.104, maternità, profilo infermiere DM 739, profilo OSS, ruolo coordinatore).
- **`checkNeoassunti(ctx, piano)`**: rileva turni con ≥2 neoassunti e nessun Senior/Esperto/Referente. **Non bloccante.**
- **`classifyOperator`** potenziata: priorità a livello esplicito → anni di esperienza → competenze.
- **`publishGate`**: aggiunto controllo "Alert neoassunti" come **warn** (mai bloccante); bloccano solo
  11h/recupero/smonto/max-6/esenzioni. Provato: piano pulito con neoassunti resta pubblicabile.
- **`rankSubstitutes`**: aggiunta priorità per **livello professionale** (Referente→Esperto→Senior→Junior→Neoassunto),
  mantenendo prioritari vincoli ed equità.

### Profilo professionale
- `Staff` + `anniEsperienza?` e `livello?` (tipo `OperatorClass`). Campi **opzionali**, non bloccano la generazione.
- `COMPETENZE_AREE` e `LIVELLI` in costanti. Competenze informative (non vincolanti).

### UI
- **Pulsante globale Assistente** (logo ✦ nell'header) presente in tutte le schermate principali → apre l'Assistente.
- Nuova schermata **Assistente Coordinatore AI** (`screens/AssistenteScreen.tsx`, route `app/assistente.tsx`, modale):
  Chat (Q&A offline + domande rapide), Personale (classificazione + fatigue con bande 0-25/26-50/51-75/76-100),
  Criticità (publishGate + alert neoassunti), Suggerimenti (proposte matrice + **"Applica tutte le proposte"**).
- **Wizard operatore**: nuovo blocco Profilo (anni esperienza, livello, competenze).
- Store: nuova azione **`applyMatriceProposals()`** (applica `proposeMatrice` a tutti, rigenera, ritorna n. modificati).

### Verifiche
- Backbone: tutti gli intenti dell'assistente, classificazione, neoassunti, gate, normativa → verdi.
- Regressione completa (14 suite) verde; bug coordinatore "solo mattina" riconfermato risolto.
- **Audit 30/50/100 operatori × 24 mesi** (Coordinatore AI, optimize ON): 11h cross-month=0, recupero=0,
  smonto valido, max-6, coordinatore 0 notti/weekend/festivi (anche "solo mattina"), determinismo, copertura 90-94%,
  funzioni AI raggiungibili sul piano reale.

### Non incluso / da completare (dichiarato)
- Dashboard direzionale come schermata separata; copilot dentro **ogni** wizard; costruttore matrice **dentro** ogni
  wizard; superficie alert/fatigue anche in Report. La UI **non** è verificabile a runtime offline (solo controlli statici).


## [Fix CRITICO — crash creazione operatore (anteprima ciclo matrice non a 7 giorni)]

- **Bug**: in `StaffWizardScreen` l'anteprima del ritmo a 14 giorni calcolava la posizione nel ciclo con
  `% 7` (settimana fissa). Per ogni matrice con ciclo ≠ 7 giorni (Quinta=5, Sesta=6, Decima=10, Ottava=8,
  Turnazione 12h=5, **TM "Solo Mattina"**, TA, TN1=3, ...) l'indice usciva dall'array → `seq[pos]`
  `undefined` → `colors.shift[undefined].bg` → **crash di render**: la schermata di creazione/modifica
  operatore si bloccava e l'operatore non veniva salvato. Riproducibile con il Coordinatore "Solo Mattina"
  (matrice TM) e con tutte le matrici cliniche reali.
- **Fix**: la posizione nel ciclo ora usa la **lunghezza reale della sequenza** della matrice
  (`% mxPreview.seq.length`) con guardia anti-undefined; accesso ai colori turno reso difensivo
  (`colors.shift[t] || colors.shift.R`) anche nell'elenco matrici. File: `screens/StaffWizardScreen.tsx`.
- **Verificato**: 0 indici undefined su tutte le matrici × offset 0–6; ciclo di vita coordinatore
  (salva/modifica/elimina) senza crash; coordinatore 0 notti/0 weekend/0 festivi, solo mattine feriali;
  generazione mai bloccata; determinismo e regressione completa (13 suite) verdi.


## [Coordinatore AI: ottimizzatore collegato (3 modalità) · classificazione automatica · proposta matrice]

- **FASE 10 — Ottimizzatore collegato all'app.** Nuovo `aiMode` con 3 modalità: **Rapida** (solo
  matrice, massima aderenza), **Equa** (ottimizzatore+equità), **Coordinatore AI** (ottimizzatore +
  equità + desiderata + preferenze). Default: Coordinatore AI. `optimize` è ora propagato a TUTTE le
  generazioni dello store (era sempre `false`). Selettore in Impostazioni. Persistente + migrazione.
- **FASE 3 — Classificazione automatica** (`classifyOperator`): Neoassunto/Junior/Senior/Esperto/
  Referente da qualifica + skill matrix, con motivazioni.
- **FASE 4 — Proposta automatica della matrice** (`proposeMatrice`/`proposeAllMatrici`): l'AI propone
  la matrice per operatore (rispettando preferenze forti ed esenzioni) con spiegazione.

> Prova reale: in modalità Coordinatore AI su 30/50/100 operatori × 24 mesi la dispersione delle notti
> cala nettamente (50 op: 50%→26%; 100 op: 65%→40%) e le ore si bilanciano, **mantenendo 11h/recupero/
> max-6 a 0, coordinatore 0/0/0 e copertura ≥90%**. L'aderenza alla matrice scende (≈70%) in Coordinatore
> AI: è il compromesso atteso fra equità e fedeltà alla matrice, ora scelto dall'utente.

> Restano NON implementate: Fasi 5 (equità storica pluriennale), 6 (simulatore strategico), 7 (skill mix
> VINCOLANTE in generazione — oggi solo gate di pubblicazione), 8 (auto-ribilanciamento), 11–13
> (auto-rebalance/fatigue in generazione/dashboard UI) e l'integrazione UI del backbone. Vedi report.


## [Rebranding TURNOVER · backbone di verifica: fatigue score + gate di pubblicazione + skill mix]

- **Rebranding completo TurniAI → TURNOVER**: nome app, slug, scheme, bundle id (`com.turnover.app`),
  nome progetto/package, footer PDF, marker backup, placeholder import, nomi file di backup,
  chiavi di storage (`turnover_data_v1`/`turnover_theme_v1`) con **migrazione automatica** dai dati
  storici `turniai_*`. Import backup **retro-compatibile**: accetta sia `TURNOVER` sia `TurniAI`.
  Il **checksum** dei backup è invariato (calcolato sui soli dati).
- **Fatigue score** (`fatigueScore`): indice 0–100 per operatore da notti/weekend/festivi/
  concentrazione del lavoro negli ultimi giorni del mese.
- **Skill matrix** (dati): campo opzionale `competenze` su operatore (area + livello + date), backward-safe.
- **Skill mix** (`skillMixCheck`): rilevazione turni privi di referente/competenze critiche (rilevazione,
  non ancora vincolo in generazione).
- **Gate di pubblicazione** (`publishGate`): aggrega i controlli inviolabili (11h, recupero post-notte,
  smonto, max 6 consecutivi, copertura) + fatigue + skill mix e **blocca** se anche uno fallisce.

> Nota: le Fasi 3 (acuità dinamica), 5 (equità storica pluriennale), 6 (simulatore strategico),
> 7 (assenze predittive), 8 (auto-ribilanciamento) e 9 (dashboard direzionale), e l'integrazione UI
> delle nuove funzioni, NON sono incluse in questa release. Vedi report di audit.


## [Catalogo matrici reali · gerarchia Operatore→Reparto→Mese · matrici personalizzate · audit]

Revisione architetturale: il motore **applica matrici contrattuali reali** da un catalogo
configurabile — non le inventa e non sceglie autonomamente. La **matrice è la regola**;
l'ottimizzatore interviene solo come raffinamento opzionale.

- **Catalogo matrici** (`utils/constants.ts`) con metadati per voce — nome, descrizione,
  sequenza, durata ciclo, compatibilità reparto/ruolo: **Quinta** `M P N S R`,
  **Sesta** `M M P P N S`, **Decima** `M M P P R N N S R R`, **Ottava** `M M P P N N S R`,
  **12 Ore** `G N S R R`. Smonto **incorporato** nella matrice. Restano disponibili le
  matrici settimanali/a scalare preesistenti.
- **Nuovo turno `G`** (giornata 12h): tipo `Turno`, ore (12h), colori tema/PDF/XLSX, label.
- **Gerarchia obbligatoria** (`resolveMatrice`, motore): Operatore → Reparto → Mese → (auto
  recovery-safe come ultima istanza). Se l'operatore ha una matrice si usa quella; altrimenti
  quella del reparto; altrimenti quella del mese. L'**origine** è tracciata e mostrata.
- **Generatore matrice-first**: il piano parte esclusivamente dalla matrice assegnata;
  ≥90% dei giorni deriva dalla matrice. Le modifiche sono eccezioni (ferie/malattia/permesso/
  aspettativa/desiderata/preferenze/copertura). L'ottimizzatore equità/preferenze è ora
  **opt-in** (`optimize=true`); il taglio notti per FTE è applicato solo in ottimizzazione
  (la matrice definisce le notti).
- **Vincoli assoluti** mai derogati e verificati: riposo 11 ore, recupero post-notte, smonto,
  limite 6 giorni consecutivi, esenzioni di ruolo (coordinatore: niente notti — imposto sopra
  la matrice) e preferenze forti solo-mattina/pomeriggio.
- **Matrici personalizzate**: nuova schermata **Catalogo matrici** (`app/matrici`) per costruire
  e salvare sequenze proprie nel catalogo; persistenza (`matriciCustom`) e CRUD nello store.
- **Selezione matrice a 3 livelli in UI**: scheda operatore e reparto (catalogo completo +
  "Eredita"), **matrice del mese** in Impostazioni.
- **Audit "Aderenza alla Matrice"** (Report, `matrixReport`): per operatore matrice assegnata,
  origine, durata ciclo, posizione nel ciclo, % di rispetto, n. deroghe e motivazioni; più
  conteggi per matrice e per origine e aderenza complessiva.
- **Persistenza**: `matriciCustom` e `matriceMese` letti da `loadData`; formato/checksum del
  **backup invariati** (i nuovi campi sono omessi dal core del backup).

### Test
- **Test specifici per ogni matrice** (Quinta/Sesta/Decima/Ottava/12h): aderenza ≥90%
  (100% su organico bilanciato), 11 ore = 0, smonto valido (anche a cavallo di mese),
  max 6 consecutivi. Test di gerarchia (operatore/reparto/mese) e di matrice personalizzata.
- Batteria di regressione completa verde; invarianti SACRI a 0 (copertura, 11 ore, recupero,
  consecutivi, esenzioni). Le metriche soft di equità (alternanza festivi, confinamento
  multi-reparto) sono ora **subordinate alla matrice** per mandato esplicito.

## [Collegamento UI: preferenze · desiderata · modalità · report deroghe]

Completato il collegamento tra motore e interfaccia (nessuna modifica algoritmica al motore).

- **Scheda operatore (StaffWizard, step 7)**: preferenze forti (no notti, no weekend, no
  festivi, solo mattina, solo pomeriggio) e deboli (preferenza mattina/pomeriggio, weekend
  libero, reparto preferito, settore preferito). Salvate su `Staff.preferenze` /
  `esenteWeekend` / `esenteFestivi`.
- **Schermata Desiderata** (nuova, `app/desiderata`): elenco ordinato, creazione, modifica ed
  eliminazione. Per desiderata: operatore, data singola o intervallo, tipologia
  (lavorare/riposo/mattina/pomeriggio/evita notte), priorità (bassa/media/alta).
- **Schermata Impostazioni** (nuova, `app/impostazioni`): scelta Modalità Rigida / Operativa
  con priorità descritte; **salvataggio persistente** in AsyncStorage.
- **Report → "Deroghe Generate"**: elenco con operatore, giorno, reparto, tipo deroga e
  motivazione (dal piano del mese corrente).
- **Store**: `mode` e `desiderata` aggiunti allo stato e a `ctxOf` (tutte le generazioni li
  ereditano), con persistenza e CRUD (`setMode`, `addDesiderata`, `updateDesiderata`,
  `removeDesiderata`); ogni operazione rigenera il piano del mese e registra l'audit.
- Backup invariato (formato e checksum non toccati); mode/desiderata persistiti nello storage
  principale, non nel file di backup.

---

## [Modalità di generazione · Deroghe · Preferenze · Desiderata]

### 1. Modalità di generazione (configurazione globale del motore)
- **Rigida**: priorità 11h → recupero → equità → preferenze → copertura. La copertura può
  scendere: notti oltre quota, weekend/festivi per operatori esenti restano vincoli **duri**.
- **Operativa** (default): priorità 11h → recupero → copertura → equità → preferenze. Il
  motore punta al 100% di copertura e, quando necessario, genera **deroghe controllate**
  (tracciate). Le 11 ore, il recupero post-notte, il limite di 6 giorni consecutivi e le
  esenzioni di ruolo del coordinatore restano **non derogabili** in entrambe le modalità.
- `EngineContext.mode` ('rigida' | 'operativa'); default 'operativa'.

### 2. Registro deroghe controllate
- Ogni deroga registra operatore, giorno, reparto, motivo e regola derogata
  (`BuildStats.derogheList: Deroga[]`). Regole derogabili in operativa: superamento quota
  notti, weekend extra, festivo extra (più lo straordinario di monte ore). **Le 11 ore non
  sono mai derogabili.**

### 3. Preferenze personali (`Staff.preferenze`)
- **Forti**: no notti / no weekend / no festivi (campi esistenti esenzioniTurni/esente*),
  solo mattina, solo pomeriggio. Applicate come vincoli duri (template dedicati TM/TP +
  eleggibilità in copertura e ottimizzazione).
- **Deboli**: preferenza mattina/pomeriggio, weekend libero, settore, reparto. Soft: pesano
  nell'obiettivo (peso maggiore in rigida, minore in operativa).

### 4. Desiderata (nuova entità `Desiderata`)
- Per operatore: data o intervallo, tipo (lavoro/riposo/mattina/pomeriggio/evitaNotte),
  priorità (bassa/media/alta). Rispettati come termine soft in copertura e ottimizzazione,
  pesati per priorità. `EngineContext.desiderata`.

### 5. Ottimizzazione e metriche
- L'ottimizzatore bilancia desiderata + preferenze + equità mantenendo la copertura.
- `prefSatisfaction(ctx, piano)` calcola **% preferenze deboli soddisfatte** e **% desiderata
  soddisfatti** (esposte in `BuildStats.prefPct` / `desPct`).

### 6. Report — sezione "Qualità Organizzativa"
- Nuova sezione in ReportScreen: Copertura, Equità, Coerenza, Preferenze soddisfatte %,
  Desiderata soddisfatti %, Deroghe generate. `SimResult` esteso di conseguenza. PDF, XLSX,
  backup, audit e undo/redo invariati.

### 7. Validazione (43 operatori · 12 mesi, entrambe le modalità)
- Rigida: copertura 98.6%, deroghe 235, preferenze 67%, desiderata 75%, 11h 0, recupero 0,
  oreCV 4%. Operativa: copertura 99.0%, deroghe 252, preferenze 61%, desiderata 79%, 11h 0,
  recupero 0, oreCV 4%. Preferenze forti (solo mattina/solo pomeriggio/no notti) rispettate
  al 100% in entrambe. Operativa copre più della rigida usando deroghe; rigida soddisfa più
  preferenze deboli. Nessuna regressione (smonto, equità, STEP 0, scala 30/50/100, audit,
  validatore, XLSX/PDF/backup).

---

## [Equità notti FTE · Ruoli · Festivi · Giorni consecutivi] (C1·C2·C3·C5)

### C1 — Perequazione notti su base FTE
- La quota notti mensile teorica è il `nottiMax` del contratto (∝ ore/FTE: FT36=5, PT75=3,
  PT50=2, …). Tre meccanismi la rendono effettiva: (a) i **part-time** non ricevono più un
  ciclo solo-notte — hanno sempre base diurna + un solo blocco notte; (b) **taglio notti**
  dopo la generazione: le notti che il template assegna oltre la quota diventano riposo e
  liberano slot che la copertura ridistribuisce verso chi è sotto quota; (c) **tetto duro**
  in copertura e ottimizzazione (nessuno supera `nottiMax`) + **penalità elevata** nella
  funzione obiettivo. Le notti seguono ora il contratto, non il template.

### C2 — Modello di ruolo (applicato per qualifica)
- **Coordinatore** (qualifica con "coordinat"): automaticamente solo giornata feriale —
  escluso da notti, weekend e festivi.
- **Specialista** (e ogni operatore): esenzioni weekend/festivi **configurabili**
  (`esenteWeekend`, `esenteFestivi`) oltre all'esenzione notti esistente. Le esenzioni sono
  applicate in base/copertura/ottimizzazione (mai lavoro nei giorni esenti).

### C3 — Festivi: equità + memoria storica + alternanza
- Distribuzione più equa dei festivi (preferenza in copertura a chi ne ha lavorati meno).
- **Memoria storica annuale**: `EngineContext.festiviCount` (festivi già lavorati nell'anno)
  e `festiviMajor` (chi ha lavorato i festivi maggiori l'anno precedente).
- **Alternanza dei festivi maggiori** (Natale, Capodanno, Pasqua, Pasquetta, Ferragosto):
  chi ha lavorato un festivo maggiore ha priorità negativa per lo stesso festivo l'anno dopo
  (penalità in copertura e nell'obiettivo).

### C5 — Massimo 6 giorni consecutivi = vincolo DURO
- Da penalità soft a **vincolo duro**: il motore non può generare 7 giorni consecutivi, né
  in copertura, né in ottimizzazione, né dai template a cavallo di mese. Gate in copertura e
  ottimizzatore + passaggio di enforcement (con continuità cross-mese) che converte in
  riposo il giorno eccedente. Tetto per operatore = `min(giorniCons del contratto, 6)`.

### Validazione (43 operatori · 24 mesi) — tutto verificato
- Notti FTE: PT ≤ FT, nessuno oltre la quota mensile. Coordinatore 0 notti / 0 weekend /
  0 festivi. Specialisti esenti 0 weekend / 0 festivi. Festivi σ≈2.0; alternanza Natale
  (la maggioranza non ripete l'anno dopo). Giorni consecutivi: max 6. Copertura ~99%,
  11h 0/0, recupero 0, cross-mese 0/0, determinismo. Nessuna regressione (smonto, equità,
  STEP 0, scala 30/50/100, validatore, XLSX/PDF/backup/audit).

---

## [Recupero inviolabile + equità reparti/settori + Qualità Operativa]

### Modello SMONTO (chiarito e verificato)
- Lo smonto `S` **non è un turno, non è un riposo**: è semplicemente il giorno dopo una
  notte, generato automaticamente. Non assegnabile, non copribile, non modificabile.
  Non conta nelle ore (`shiftHours('S')=0`), non conta nei riposi (i riposi sono solo `R`),
  e **non è mai una violazione 11h** rispetto alla notte che lo precede (i controlli 11h
  ignorano le celle non lavorative). Dopo `N N S R R` i due riposi *reali* sono quelli
  **dopo** lo smonto.

### 1. Recupero post-notte INVIOLABILE (vincolo forte)
- Le sequenze `N S R` e `N N S R R` sono blocchi protetti: `nb` notti → smonto + `nb`
  riposi reali, tutti non lavorativi.
- Nessuna fase può romperli: `protectRecovery` marca smonto+riposi prima della copertura;
  lo **STEP 5** non riempie mai `S` né i riposi di recupero (skip su `riposoForzato`), e una
  notte piazzata dalla copertura **protegge subito** il proprio recupero; lo **STEP 6** ha
  un gate forte (`rowRecoveryOk`) che rifiuta ogni scambio che lascerebbe una notte senza
  recupero completo. Verificato: **0 violazioni** a 30/50/100 e su 12 mesi.

### 2. Migrazione automatica dei template
- Gli operatori senza template (matrice legacy o assente) ricevono automaticamente un
  template coerente con qualifica, contratto, abilitazione notti e part-time/full-time
  (`autoTemplateIds`/`migrateTemplates`). Le matrici legacy non vengono più usate in
  generazione: niente più mix legacy/template. La matrice nasce coerente (coerenza
  pre-ottimizzazione 90/100; auto 84-87/100).

### 3. Equità reparti e settori nella funzione obiettivo
- `qualityPenaltyOp` penalizza la **concentrazione** in un solo settore e in un solo
  reparto (anti-confinamento), passato il numero di reparti dell'operatore a tutti i
  chiamanti. Verificato: **nessun operatore confinato** in un solo settore/reparto a
  30/50/100.

### 4. Report "Qualità Operativa"
- Nuova sezione con indice di equità, indice di coerenza, le 8 differenze (ore, notti,
  weekend, festivi, riposi, smonti, reparti, settori) e le criticità rilevate. Per ogni
  operatore: settore/reparto più e meno assegnato.

### Invarianti verificati (nessuna regressione)
- 11h **0/0 su 24 mesi**, copertura invariata dall'ottimizzazione, continuità cross-mese
  0/0, smonti corretti, determinismo, PDF/XLSX/backup+tamper/audit/undo-redo: tutti verdi.

---

## [STEP 0 — Template di rotazione] — La matrice nasce già ordinata

### Nuovo STEP 0 prima della generazione
- Introdotto lo **STEP 0**: il motore costruisce la base da **template di rotazione
  compatti** invece di sequenze qualunque. I blocchi logici sono *intenzionali*, non più
  un effetto collaterale delle penalità.
- Template inclusi (in `MATRICI`, quindi selezionabili e configurabili):
  `TA` M M P P R · `TB` M M M P P R · `TC` P P M M R · `TD` N N S R R ·
  `TE` M M P P P R · `TN1` N S R. Lo **smonto `S` è già dentro il template notte**.
- I template sono **configurabili** (lista `MATRICI`/`ROTATION_TEMPLATES`),
  **combinabili** (nuovo campo `Staff.templateCombo`, es. `['TB','TD']` →
  `M M M P P R N N S R R`), **assegnabili automaticamente** (per profilo: solo-giorno per
  gli esenti notte, blocco giorno + blocco notte per i notturnisti, ciclo leggero per i
  part-time) e **sfasati** tra operatori (offset per-operatore).
- Pipeline: **STEP 0 template → copertura → assenze → riposi 11h → settori → equità →
  ottimizzazione**. Sorgente della sequenza per operatore: `templateCombo` esplicito →
  altrimenti `matrice` scelta → altrimenti auto.

### Copertura più rispettosa dei blocchi notte
- STEP 5 (copertura) ora, **a parità di deroghe**, preferisce i candidati che **non**
  creano blocchi di 3+ notti consecutive — senza mai ridurre la copertura (se l'unico
  candidato creerebbe 3 notti, viene comunque usato).

### Smonto robusto agli scambi
- `deriveSmonti` è ora una **normalizzazione idempotente**: ogni riposo dopo una notte
  diventa `S`, ogni `S` non più preceduto da notte (es. dopo uno scambio) torna `R`.
- L'ottimizzatore **non sposta** le celle di smonto (restano ancorate alla loro notte).

### Dimostrazione (pre-ottimizzazione)
- Indice di coerenza **prima** dell'ottimizzazione: vecchi cicli `71/100` → template
  `88/100` (auto `81/100`). Righe a blocchi riconoscibili già nel piano grezzo
  (`M M P P R`, `N N S R R`, …) per 13/14 operatori.

### Invarianti verificati (nessuna regressione)
- Riposo 11h **0/0 su 24 mesi** (anche percorso auto), copertura invariata a 30/50/100
  (100%), continuità cross-mese 0/0, assenze, equità, smonti, PDF, XLSX, backup+tamper,
  audit, undo/redo, simulatore, validatore: tutti verdi.

---

## [Smonto notte + matrice realistica] — Motore da assegnatore a pianificatore

### Smonto notte come categoria separata (`S`)
- Introdotto il turno **`S` = Smonto notte**: né lavoro né riposo. È una categoria a sé,
  con colore e legenda propri in app, PDF e XLSX.
- Lo smonto è il **primo giorno non lavorativo dopo un blocco di notti** (quel giorno era
  già forzato a riposo dalle 11h, quindi **copertura e riposo 11h restano identici per
  costruzione** — è una ri-etichettatura, non un nuovo vincolo).
- Sequenze post-notte ora prodotte: **`N S R`** (1 notte → smonto → riposo) e
  **`N N S R R`** (2 notti → smonto → 2 riposi). Cross-mese gestito tramite il bordo
  del mese precedente (notte a fine mese → smonto al giorno 1 successivo).
- I conteggi sono corretti ovunque: `isWork('S')=false`, lo smonto **non** è conteggiato
  tra i riposi né tra le ore; un nuovo contatore **smonti** lo traccia separatamente.

### Indice di Coerenza della Matrice (0–100)
- Nuovo indicatore in *Report* accanto all'Indice di Equità. Valuta compattezza delle
  sequenze, qualità delle rotazioni, recuperi post-notte, distribuzione dei riposi e
  assenza di alternanze casuali (leggibilità della riga di ogni operatore).

### Ottimizzatore consapevole di smonto, coerenza e qualità
- L'ottimizzatore (STEP 6) ora bilancia anche gli **smonti** e tratta un `R` dopo `N`
  come smonto (non come riposo), così i **riposi reali** restano equilibrati.
- Nuove **penalità di qualità**: più di 2 notti consecutive, più di 6 giorni lavorativi
  consecutivi, più di 3 riposi consecutivi, più di 2 weekend lavorati consecutivi,
  permanenza eccessiva nello stesso settore.
- Nuovi **termini di coerenza**: transizioni innaturali (`N→M/P`, `M/P→N`), giorni di
  lavoro isolati fra riposi, alternanze (`M P M`, `P N P N`…) sono penalizzate, così le
  matrici risultano compatte e leggibili (coerenza in salita dopo l'ottimizzazione).

### Validatore aggiornato
- Nuovi controlli: **notti senza smonto**, **doppia notte senza doppio recupero**,
  **qualità/coerenza della matrice** (indice esposto in `PianoCheck.coherenceIndex`).
  Il punteggio finale integra ora anche la coerenza.

### Test (ambiente offline: tsc statico + emit CommonJS + harness Node)
- **Smonto**: 0 transizioni `N→M/P`, sequenze `N S`/`N N S`, copertura invariata,
  riposo 11h **0/0 su 24 mesi**, `S` escluso da lavoro/riposi, deterministico.
- **Scala 30/50/100** (baseline vs ottimizzato): ore 84–90 → 24–30, riposi 11–12 → 1–2,
  notti 11 → 7–8, equità 35–36 → 58–59, **coerenza 79–83 → 91–95**; copertura 100%
  invariata, 11h 0 violazioni, deterministico, < 1s anche a 100 operatori.
- Regressione completa verde: continuità mensile/annuale, copertura, assenze, PDF, XLSX,
  backup+tamper, migrazione, simulatore, validatore.

### Compatibilità
- I piani già salvati non vengono ri-etichettati automaticamente (lo smonto è esplicito):
  vengono prodotti smonti **alla rigenerazione**. Nessuna rottura di backup/audit/undo.

---

## [Motore di equità] — Da assegnatore a ottimizzatore (coordinatore infermieristico)

### Nuovo modello di generazione
- Aggiunta una **fase di ottimizzazione post-generazione** (STEP 6): dopo aver
  costruito un piano valido (matrice → assenze → riposo 11h → settori → copertura),
  il motore **analizza l'intero mese** e ribilancia automaticamente i carichi finché
  non trova la distribuzione migliore. Non si ferma alla prima soluzione valida.
- Lo strumento dell'ottimizzazione è lo **scambio di intera cella** (turno + reparto +
  settore) **fra due operatori nello stesso giorno**: il multiset dei turni del giorno
  resta identico → **la copertura non cambia mai**, cambia solo *chi* fa cosa.
- Uno scambio è applicato solo se **non viola il riposo 11h** (anche ai bordi del mese,
  via `prevEdge`/`nextEdge`), **rispetta l'eleggibilità** di entrambi (reparti/settori/
  esenzioni/notti) e **riduce il costo globale** (varianza delle metriche + penalità di
  qualità). Ricerca locale **greedy deterministica** (ordine fisso, niente casualità) →
  risultato riproducibile, compatibile con undo/redo e con i test.

### Vincoli di equità e qualità
- Equità: minimizza la differenza tra operatori su **ore, mattine, pomeriggi, notti,
  weekend, festivi, riposi, settori**. Tra operatori comparabili raggiunge il **±1** su
  notti/weekend/festivi; lo scarto globale residuo è strutturale (esenzioni notti,
  part-time, ferie) e non comprimibile da alcun algoritmo.
- Qualità (penalità automatiche): **3+ notti consecutive**, troppi pomeriggi consecutivi,
  troppi giorni lavorati consecutivi (oltre soglia di contratto), troppi riposi
  consecutivi, ripetizione dello stesso settore in giorni consecutivi.

### Indice di equità (0–100)
- `analytics.computeEquity`/`SimResult` espongono ora **differenza ore, notti, weekend,
  festivi, riposi** e un **punteggio 0–100** che il generatore massimizza. Visibili nel
  **Report** (riga "Differenze max") e nel toast di generazione ("equità X/100").

### File modificati
- `services/engine.ts` — STEP 6 + modulo ottimizzatore (`optimizePiano`, `scoreMonth`,
  penalità di qualità, scambi vincolati, ricalcolo deroghe finali). `buildPiano` ha un
  6° parametro `optimize=true` (retrocompatibile).
- `services/analytics.ts` — `EquityReport`/`SimResult` con i 5 differenziali + riposi nel
  punteggio; `isHoliday` ri-esportato.
- `utils/helpers.ts` — spostate qui `isHoliday`/festività (così il motore le usa senza
  ciclo con analytics).
- `types/index.ts` — `BuildStats` con `equityBefore`/`equityAfter`/`optSwaps`/`optPasses`.
- `screens/ReportScreen.tsx`, `screens/TurniScreen.tsx` — esposizione di indice e diff.

### Garanzie preservate (verificate da simulazioni)
- **Copertura invariata** dagli scambi · **0 violazioni 11h** interne e **0 al confine
  tra mesi** (24 mesi consecutivi) · niente 3 notti consecutive · **determinismo** ·
  sistema assenze/backup/validatore/XLSX/PDF senza regressioni.

## [Assenza unificata] — Sigla unica ASS + motivazione libera

### Nuovo modello
- Le 8 tipologie predefinite (Ferie, Malattia, Permesso, Legge 104, Formazione,
  Congedo, Infortunio, Aspettativa) sono sostituite da **un'unica assenza "ASS"**
  con **colore unico configurabile** (`ASS_COLOR` / `ASS_SOFT` in `utils/constants.ts`)
  e **motivazione a testo libero**. In inserimento l'utente compila solo data inizio,
  data fine e motivazione.
- **Griglia**: ogni assenza è mostrata come `ASS`. **Dettaglio cella**: banner di sola
  lettura con la motivazione completa. **PDF**: cella `ASS`, legenda "ASS = Assenza" e
  sezione "Assenze (motivazioni)" per pagina/reparto. **XLSX**: cella `ASS`, voce unica
  in legenda e foglio dedicato **"Assenze"** (Operatore · Dal · Al · Motivazione).
- **Statistiche/Simulatore**: i giorni di assenza confluiscono in un unico conteggio
  `assenze`, con ripartizione per motivazione libera (`assenzePerTipo`). **Validatore**
  aggiornato. Backup/Ripristino, Audit Log e Undo/Redo trasportano la nuova motivazione.

### Migrazione automatica (nessun dato perso)
- All'avvio (`loadData`) e all'import di backup (`importBackup`) le assenze esistenti
  sono convertite: FER→"Ferie", MAL→"Malattia", PER→"Permesso", 104→"Legge 104",
  FOR→"Formazione", CON→"Congedo", INF→"Infortunio", ASP→"Aspettativa". Idempotente:
  le voci con motivazione già presente non vengono toccate.

### Corretto (rilevato durante la revisione)
- `ReportScreen.doExportXLSX` referenziava variabili fuori scope (`m`/`r`) → l'export
  Excel sollevava un `ReferenceError` nel toast finale. Ora mostra l'esito corretto.

### File modificati
`types/index.ts`, `utils/constants.ts`, `utils/helpers.ts`, `services/engine.ts`,
`services/analytics.ts`, `services/validator.ts`, `services/xlsxData.ts`, `services/xlsx.ts`,
`services/pdf.ts`, `services/storage.ts`, `hooks/useStore.tsx`, `components/ShiftBadge.tsx`,
`screens/FerieWizardScreen.tsx`, `screens/StaffDetailScreen.tsx`, `screens/CellEditorScreen.tsx`,
`screens/ReportScreen.tsx`.

---

## [Audit finale] — Compatibilità import backup

### Corretto
- **Import di backup di versioni precedenti**: `parseBackup` verificava l'integrità
  ricalcolando il checksum sul payload *normalizzato* (che reintroduceva `audit: []`),
  rifiutando come "corrotto" i backup vecchi privi del campo `audit`. Ora la verifica
  usa i dati **come ricevuti**: identica al payload originariamente firmato per qualunque
  backup prodotto dall'app, robusta a campi mancanti o aggiunti in futuro, con rilevazione
  delle manomissioni invariata. *(File: `services/storage.ts`)*

### Audit (nessun'altra modifica)
Verificati senza problemi: assenze a cavallo di due mesi (due voci mensili, giorni F =
riposo, 0 violazioni al confine), reparto eliminato (nessun crash, nessuna cella orfana
dopo rigenerazione, copertura/monte ore/validatore robusti al fallback orari), modifica
manuale del primo/ultimo giorno (lock rispettato, 11h al confine garantite), simulazioni
annuali consecutive (deterministiche, 0/0 su 24 mesi), undo/redo, audit log, persistenza.

---

## [Build cross-mese] — Riposo 11h tra mesi consecutivi

### Corretto
- **Riposo 11h ora garantito anche AL CONFINE tra mesi** (ultimo giorno del mese
  precedente → primo giorno del mese successivo), incluso il passaggio
  **Dicembre → Gennaio**. Prima il vincolo era applicato solo all'interno del
  singolo mese e il salto tra mesi poteva violare le 11 ore pur con matrice continua.

### Motore (`services/engine.ts`)
- Nuovo tipo `PrevEdge` e funzioni `edgeFromPiano` (ultimo turno effettivo del mese
  precedente, con orari reali del reparto; tiene conto di assenze e modifiche manuali)
  e `nextEdgeFromPiano` (giorno 1 **bloccato** del mese successivo).
- `restOkBothSides`, `evalCandidate`, `smartFill`, `buildPiano` ora accettano
  `prevEdge` e `nextEdge` (default `{}`, **retro-compatibili**: la generazione pura
  resta invariata).
- **STEP 3** reso bidirezionale: ogni cella lavorata non bloccata cede a `R` se viola
  le 11h verso il giorno precedente (o il bordo del mese prec. al giorno 1) **oppure**
  verso una cella **bloccata** immovibile / il bordo del mese successivo (giorno dim).
- **STEP 4** (assegnazione settore) e **STEP 5** (massimizzazione copertura) verificano
  il riposo anche sul lato successivo verso celle bloccate e verso il bordo del mese dopo.

### Validatore (`services/validator.ts`)
- `checkPiano(ctx, piano, prevPiano?)`: analizza anche il confine col mese precedente,
  segnala le violazioni residue evidenziando l'operatore (`"Riposo < 11h tra mesi: …"`),
  conteggia `boundaryViolations` e riduce/cappa il punteggio (≤ 50) quando il vincolo
  non è rispettato.

### Simulatore e Monte ore (`services/analytics.ts`, `services/hours.ts`)
- `simulateRange` (12/24 mesi) e `annualHours` propagano il bordo (`prevEdge`) tra mesi
  consecutivi: le simulazioni rispettano il riposo 11h anche nei passaggi tra mesi.

### App (`hooks/useStore.tsx`, `screens/StrumentiScreen.tsx`, `screens/CellEditorScreen.tsx`)
- Store: helper `prevEdgeOf` / `nextEdgeOf`; bordo inoltrato a tutte le ricostruzioni di
  mese (generazione, navigazione, rigenerazione, modifica cella, rimozione operatore,
  init). Esposto `prevPiano`.
- "Controlla Piano" passa il mese precedente al validatore.
- Editor di cella: il blocco CCNL 11h è ora **boundary-aware** sul giorno 1 (controlla
  l'ultimo giorno del mese precedente).

### Test (offline, deterministici)
- Dic→Jan singolo operatore: **0** violazioni dentro i mesi, **0** al confine (prima 5/12).
- Validatore: rileva il confine violato, cappa il punteggio, evidenzia l'operatore.
- Casi: assenza ultimo giorno (edge esclude l'operatore), assenza primo giorno (g1=F),
  operatori aggiunti a metà anno, operatori rimossi (nessun orfano), ripristino backup.
- **Stress 100 infermieri × 10 reparti × 24 mesi** + assenze casuali + 282 modifiche
  manuali valide + rigenerazioni: **0** violazioni dentro i mesi e **0** ai 23 confini
  su ~35.300 turni.
- Regressione mirata: simulatore 12 mesi, copertura 99%, indice di equità nei limiti.
