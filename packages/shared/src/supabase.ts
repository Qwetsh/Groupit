// ============================================================
// SUPABASE CLIENT — Configuration partagée
// ============================================================

import { createClient } from '@supabase/supabase-js';

// Variables d'environnement Vite (VITE_*) — OBLIGATOIRES
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
const SUPABASE_URL: string = meta?.env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY: string = meta?.env?.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[Supabase] Variables d\'environnement manquantes: VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont obligatoires. ' +
    'Créez un fichier .env.local avec ces variables.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
