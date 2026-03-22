// ============================================================
// SUPABASE CLIENT — Configuration partagée
// ============================================================

import { createClient } from '@supabase/supabase-js';

// Variables d'environnement Vite (VITE_*) — OBLIGATOIRES
// Accès direct pour que Vite puisse les remplacer statiquement au build
// @ts-expect-error Vite injecte import.meta.env au build
const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
// @ts-expect-error Vite injecte import.meta.env au build
const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[Supabase] Variables d\'environnement manquantes: VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont obligatoires. ' +
    'Créez un fichier .env.local avec ces variables.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
