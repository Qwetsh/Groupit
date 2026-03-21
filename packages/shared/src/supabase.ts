// ============================================================
// SUPABASE CLIENT — Configuration partagée
// ============================================================

import { createClient } from '@supabase/supabase-js';

// Variables d'environnement Vite (VITE_*) — fallback sur les valeurs par défaut pour le dev
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
const SUPABASE_URL: string = meta?.env?.VITE_SUPABASE_URL
  || 'https://vzwmqahnlezlbwsjhmhl.supabase.co';
const SUPABASE_ANON_KEY: string = meta?.env?.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6d21xYWhubGV6bGJ3c2pobWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTEyMjIsImV4cCI6MjA4OTY2NzIyMn0.qpIGY5z95XWDtUnXAe1zMMbBnoXa-b8AW2vg8MADsTQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
