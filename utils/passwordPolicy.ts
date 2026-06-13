// utils/passwordPolicy.ts — policy password (FASE 4): pura, testabile, unica fonte per reset/registrazione.
export function passwordIssue(p: string): string | null {
  if (!p || p.length < 8) return 'La password deve avere almeno 8 caratteri';
  if (!/[A-Z]/.test(p)) return 'Serve almeno una lettera maiuscola';
  if (!/[a-z]/.test(p)) return 'Serve almeno una lettera minuscola';
  if (!/[0-9]/.test(p)) return 'Serve almeno un numero';
  return null;
}
