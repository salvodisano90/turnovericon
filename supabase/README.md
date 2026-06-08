# TURNOVER — Backend Supabase (schema + RLS)

Schema multi-tenant e sicurezza a livello di database per portare TURNOVER dal locale al cloud
(blocchi #1 *backend/multi-device* e #4 *sicurezza/privacy lato server*).

> ⚠️ **Non eseguito in questo ambiente** (nessuna credenziale Supabase, nessuna rete). I file SQL sono
> stati controllati staticamente (statement ben formati, parentesi e `$$` bilanciati, RLS attiva con
> policy su tutte le 11 tabelle), **non** eseguiti su Postgres. Vanno applicati e testati sul progetto reale.

## File
- `migrations/0001_schema.sql` — tabelle, indici, trigger `updated_at`.
- `migrations/0002_rls.sql` — funzioni helper, RLS, policy, vista sanitizzata `staff_public`, funzione `my_shifts`.

## Come applicarlo
1. Crea un progetto su Supabase.
2. Esegui in ordine `0001_schema.sql` poi `0002_rls.sql` (SQL Editor, oppure `supabase db push` con Supabase CLI).
3. Requisito: Postgres **15+** (Supabase lo è) per le viste *security definer* (`security_invoker = false`).

## Modello di sicurezza
- **Isolamento per organizzazione (tenant)**: ogni riga ha `organization_id`; ogni policy filtra con `app.current_org()` derivato dal profilo dell'utente autenticato. Nessun dato esce dalla propria organizzazione.
- **OWNER (coordinatore)**: accesso pieno ai dati della propria organizzazione (lettura/scrittura). È l'unico che approva/rifiuta richieste, genera/modifica piani, gestisce personale e impostazioni.
- **STAFF**: vede **solo i propri dati**. In particolare:
  - **non** legge la tabella `staff` (sensibile): usa la vista **`staff_public`** che espone esclusivamente colonne non sensibili (id, nome, qualifica, matrice, reparti, settori) — rispecchia `utils/privacy.ts` a livello DB.
  - vede solo le **proprie** richieste/ferie/reperibilità/desiderata; può creare le proprie richieste/desiderata ma **non** può cambiarne lo stato.
  - legge i propri turni tramite la funzione **`my_shifts(month_key)`** (estrae dal piano del mese solo `data->staff_id`), senza accedere al piano completo degli altri.
- **Audit append-only**: lettura riservata all'OWNER; inserimento consentito nell'organizzazione; nessun update/delete (negati di default con RLS attiva).

## Mappatura tipi app → tabelle
| App (`types/index.ts`) | Tabella |
|---|---|
| `Reparto` | `reparti` (orari/settori/postazioni/minimi/seasonal come JSONB) |
| `Staff` | `staff` (campi sensibili separati; STAFF vede `staff_public`) |
| `Ferie` | `ferie` |
| `Piano` (`Record<infId,Record<day,Cell>>`) | `pianos.data` (JSONB per mese) |
| `ApprovalRequest` | `requests` |
| `RepAssignment` | `reperibilita` |
| `Desiderata` | `desiderata` |
| `AuditEntry` | `audit` |
| `Membership` / identità | `profiles` (collega `auth.users` → org + ruolo + `staff_id`) |
| `mode`/`aiMode`/`matriceMese`/`matriciCustom`/`profile` | `org_settings` |

## Flusso di accesso (da implementare lato app/Edge Function)
1. **Sign-up coordinatore**: crea l'utente auth → inserisce una riga in `organizations` (owner = utente) → inserisce il proprio `profiles` con `role='OWNER'`.
2. **Invito staff**: l'OWNER crea il `profiles` dell'operatore (`role='STAFF'`, `staff_id` collegato) all'attivazione dell'accesso. (Oggi nell'app gli accessi staff sono in `members` lato locale: qui diventano righe `profiles`.)
3. L'app usa `organization_id` implicito (via RLS): le query non devono passarlo, ci pensano le policy.

## Cosa NON è incluso / da fare (onesto)
- **Wiring del data-layer dell'app**: oggi l'app persiste un blob su AsyncStorage. Per usare questo backend va aggiunto un livello che legge/scrive per-tabella con il client Supabase (lo stub `createSupabaseStateSync` va riscritto su queste tabelle). Non incluso qui perché richiede client + rete + test su device.
- **Edge Function di sign-up** che crea atomicamente organizzazione + profilo OWNER (consigliata per evitare stati incoerenti).
- **Test reali**: le policy non sono state eseguite; vanno verificate con utenti OWNER/STAFF reali (in particolare la vista `staff_public` e `my_shifts` su Postgres 15+).
- **Storage allegati / realtime / push**: non trattati.
- **Migrazione dati locali → cloud**: importatore una-tantum del backup JSON esistente.

## Verifiche effettuate (offline)
- Statement SQL ben formati; parentesi e `$$` bilanciati nei due file.
- RLS abilitata su **tutte** le 11 tabelle, con almeno una policy ciascuna (25 policy totali).
- Coerenza colonne ↔ modello dati dell'app.
- **Non** eseguito su Postgres (nessuna istanza/credenziale in questo ambiente).
