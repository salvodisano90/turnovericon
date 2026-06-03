# Changelog — TURNOVER

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
