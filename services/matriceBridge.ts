// services/matriceBridge.ts — ponte UI transitorio (NON è una struttura dati di dominio).
// Permette: stagione chiede "+ Nuova" → editor crea → al rientro la matrice viene auto-selezionata per quella stagione.
import { Season } from '../types';
let pendingSeason: Season | null = null;
let createdId: string | null = null;
export const matriceBridge = {
  requestForSeason(s: Season) { pendingSeason = s; createdId = null; },
  setCreated(id: string) { if (pendingSeason) createdId = id; },
  consume(): { season: Season | null; createdId: string | null } {
    const r = { season: pendingSeason, createdId };
    pendingSeason = null; createdId = null;
    return r;
  },
};
