// ============================================================
// SUPABASE UPLOAD — Push session data for jury PWA + dashboard
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { ExportResultData, ExportJuryData, ExportEleveData, PdfExportOptions } from './types';

// Variables d'environnement Vite — OBLIGATOIRES (pas de fallback hardcodé)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
const SUPABASE_URL: string = meta?.env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY: string = meta?.env?.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[supabaseUpload] Variables d\'environnement manquantes: VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont obligatoires.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Pseudonymise un élève : "Prénom N."
 */
function pseudonymize(prenom: string, nom: string): string {
  const cleanPrenom = prenom.trim();
  const initial = nom.trim().charAt(0).toUpperCase();
  return `${cleanPrenom} ${initial}.`;
}

/**
 * Génère un hash SHA-256 pour un élève (matching retour)
 */
async function hashEleve(nom: string, prenom: string, classe: string): Promise<string> {
  const raw = `${nom.trim().toLowerCase()}|${prenom.trim().toLowerCase()}|${classe.trim().toLowerCase()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Vérifie si une session a déjà des notes enregistrées (final_scores).
 */
export async function checkSessionHasScores(sessionCode: string): Promise<{ hasScores: boolean; count: number }> {
  try {
    const code = sessionCode.toUpperCase().slice(0, 8);
    const { data: session } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('code', code)
      .single();

    if (!session) return { hasScores: false, count: 0 };

    const { data: jurys } = await supabase
      .from('session_jurys')
      .select('id')
      .eq('session_id', session.id);

    if (!jurys || jurys.length === 0) return { hasScores: false, count: 0 };

    const juryIds = jurys.map(j => j.id);
    const { data: eleves } = await supabase
      .from('session_eleves')
      .select('id')
      .in('jury_id', juryIds);

    if (!eleves || eleves.length === 0) return { hasScores: false, count: 0 };

    const eleveIds = eleves.map(e => e.id);
    const { count } = await supabase
      .from('final_scores')
      .select('id', { count: 'exact', head: true })
      .in('eleve_id', eleveIds);

    return { hasScores: (count ?? 0) > 0, count: count ?? 0 };
  } catch {
    return { hasScores: false, count: 0 };
  }
}

/**
 * Upload les données d'une session vers Supabase pour la PWA jury et le dashboard.
 * Crée la session, les jurys et les élèves pseudonymisés.
 *
 * Appelé lors de l'export PDF quand un sessionCode est fourni.
 */
export async function uploadSessionToSupabase(
  data: ExportResultData,
  options: PdfExportOptions & { sessionCode: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Auth anonyme
    const { data: { session: authSession } } = await supabase.auth.getSession();
    console.log('[supabaseUpload] Session auth existante:', !!authSession);
    if (!authSession) {
      const { error: authErr } = await supabase.auth.signInAnonymously();
      if (authErr) {
        console.error('[supabaseUpload] Auth anonyme échouée:', authErr);
        return { success: false, error: `Auth échouée: ${authErr.message}` };
      }
      console.log('[supabaseUpload] Auth anonyme OK');
    }

    // Code session limité à 8 chars (VARCHAR(8) en DB)
    const sessionCode = options.sessionCode.toUpperCase().slice(0, 8);
    console.log(`[supabaseUpload] Début upload session "${sessionCode}" — ${data.jurys.length} jurys, URL: ${SUPABASE_URL}`);

    // 2. Vérifier si la session existe déjà
    const { data: existingSession } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('code', sessionCode)
      .single();

    let sessionId: string;

    if (existingSession) {
      // Session existe → mettre à jour les métadonnées
      sessionId = existingSession.id;

      const { error: updErr } = await supabase.from('exam_sessions').update({
        scenario_name: data.scenarioName,
        date_oral: options.dateOral || null,
      }).eq('id', sessionId);

      if (updErr) {
        console.warn('[supabaseUpload] Update session:', updErr.message);
      }

      // Supprimer les anciens jurys (CASCADE supprimera session_eleves, evaluations, etc.)
      const { error: delErr } = await supabase
        .from('session_jurys')
        .delete()
        .eq('session_id', sessionId);

      if (delErr) {
        console.warn('[supabaseUpload] Delete anciens jurys:', delErr.message);
      }
    } else {
      // Créer la session
      const now = new Date();
      const expiryYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
      const expiresAt = new Date(expiryYear, 6, 3).toISOString(); // 3 juillet

      console.log('[supabaseUpload] Création session...');
      const { data: newSession, error: sessErr } = await supabase
        .from('exam_sessions')
        .insert({
          code: sessionCode,
          scenario_name: data.scenarioName,
          date_oral: options.dateOral || null,
          expires_at: expiresAt,
        })
        .select('id')
        .single();

      if (sessErr || !newSession) {
        console.error('[supabaseUpload] Erreur insert exam_sessions:', sessErr);
        return { success: false, error: `Erreur création session: ${sessErr?.message}` };
      }

      console.log('[supabaseUpload] Session créée:', newSession.id);
      sessionId = newSession.id;
    }

    // 3. Créer les jurys et élèves (passe 1 : sans binome_id)
    const globalIdMap = new Map<string, string>(); // eleveId local → UUID Supabase

    for (let juryIdx = 0; juryIdx < data.jurys.length; juryIdx++) {
      const jury = data.jurys[juryIdx]!;
      const juryNumber = juryIdx + 1;
      const hasBinomes = jury.eleves.some(e => e.binomeEleveId);

      const { data: newJury, error: juryErr } = await supabase
        .from('session_jurys')
        .insert({
          session_id: sessionId,
          jury_number: juryNumber,
          jury_name: jury.juryName,
          salle: jury.salle || null,
          mode: hasBinomes ? 'collectif' : 'solo',
        })
        .select('id')
        .single();

      if (juryErr || !newJury) {
        console.error(`[supabaseUpload] Erreur jury ${jury.juryName}:`, juryErr);
        continue;
      }

      // 4. Créer les élèves pseudonymisés (sans binome_id)
      const juryMap = await uploadJuryEleves(newJury.id, jury);
      for (const [localId, supaId] of juryMap) {
        globalIdMap.set(localId, supaId);
      }
    }

    // 5. Passe 2 : mettre à jour les binome_id maintenant que tous les IDs existent
    const binomeUpdates: { supaId: string; binomeSupaId: string }[] = [];
    for (const jury of data.jurys) {
      for (const eleve of jury.eleves) {
        if (eleve.binomeEleveId) {
          const supaId = globalIdMap.get(eleve.eleveId);
          const binomeSupaId = globalIdMap.get(eleve.binomeEleveId);
          if (supaId && binomeSupaId) {
            binomeUpdates.push({ supaId, binomeSupaId });
          }
        }
      }
    }

    for (const { supaId, binomeSupaId } of binomeUpdates) {
      await supabase.from('session_eleves').update({ binome_id: binomeSupaId }).eq('id', supaId);
    }

    if (binomeUpdates.length > 0) {
      console.log(`[supabaseUpload] ${binomeUpdates.length} liens binômes créés`);
    }

    console.log(`[supabaseUpload] Session ${sessionCode} uploadée: ${data.jurys.length} jurys`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[supabaseUpload] Erreur:', err);
    return { success: false, error: message };
  }
}

/**
 * Upload les élèves d'un jury (pseudonymisés avec hash).
 * Retourne un map eleveId local → session_eleves.id (UUID Supabase)
 * pour résoudre les binômes en 2ème passe.
 */
async function uploadJuryEleves(
  juryId: string,
  jury: ExportJuryData,
): Promise<Map<string, string>> {
  const localToSupabase = new Map<string, string>();
  if (jury.eleves.length === 0) return localToSupabase;

  const rows = await Promise.all(
    jury.eleves.map(async (eleve: ExportEleveData, idx: number) => ({
      jury_id: juryId,
      eleve_hash: await hashEleve(eleve.nom, eleve.prenom, eleve.classe),
      display_name: pseudonymize(eleve.prenom, eleve.nom),
      classe: eleve.classe,
      parcours: eleve.parcoursOral || null,
      sujet: eleve.sujetOral || null,
      ordre_passage: idx + 1,
      heure_passage: eleve.heurePassage || null,
      status: 'pending',
    }))
  );

  const { data: inserted, error } = await supabase
    .from('session_eleves')
    .insert(rows)
    .select('id');

  if (error || !inserted) {
    console.error(`[supabaseUpload] Erreur élèves jury ${jury.juryName}:`, error);
    return localToSupabase;
  }

  // Mapper eleveId local → UUID Supabase (même ordre d'insertion)
  for (let i = 0; i < jury.eleves.length; i++) {
    const localId = jury.eleves[i]!.eleveId;
    const supaId = inserted[i]?.id;
    if (localId && supaId) {
      localToSupabase.set(localId, supaId);
    }
  }

  return localToSupabase;
}
