// ============================================================
// SUPABASE UPLOAD — Push session data for jury PWA + dashboard
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { ExportResultData, ExportJuryData, ExportEleveData, PdfExportOptions } from './types';

// Réutiliser les mêmes credentials que le shared package
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meta = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
const SUPABASE_URL: string = meta?.env?.VITE_SUPABASE_URL
  || 'https://vzwmqahnlezlbwsjhmhl.supabase.co';
const SUPABASE_ANON_KEY: string = meta?.env?.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6d21xYWhubGV6bGJ3c2pobWhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTEyMjIsImV4cCI6MjA4OTY2NzIyMn0.qpIGY5z95XWDtUnXAe1zMMbBnoXa-b8AW2vg8MADsTQ';

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
    if (!authSession) {
      await supabase.auth.signInAnonymously();
    }

    const sessionCode = options.sessionCode.toUpperCase();

    // 2. Vérifier si la session existe déjà (upsert basé sur le code)
    const { data: existingSession } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('code', sessionCode)
      .single();

    let sessionId: string;

    if (existingSession) {
      // Session existe → mettre à jour et supprimer les anciennes données
      sessionId = existingSession.id;

      await supabase.from('exam_sessions').update({
        scenario_name: data.scenarioName,
        date_oral: options.dateOral || null,
        type_oral: options.typeOral || 'dnb',
      }).eq('id', sessionId);

      // Supprimer les anciennes données (cascade via FK si configuré, sinon manuellement)
      const { data: oldJurys } = await supabase
        .from('session_jurys')
        .select('id')
        .eq('session_id', sessionId);

      if (oldJurys && oldJurys.length > 0) {
        const oldJuryIds = oldJurys.map(j => j.id);

        // Supprimer élèves → évaluations + scores finaux seront cascade
        await supabase.from('session_eleves').delete().in('jury_id', oldJuryIds);
        await supabase.from('jury_members').delete().in('jury_id', oldJuryIds);
        await supabase.from('session_jurys').delete().eq('session_id', sessionId);
      }
    } else {
      // Créer la session
      // Expiration : 3 juillet de l'année en cours (ou prochaine si on est après)
      const now = new Date();
      const expiryYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear(); // juillet = mois 6
      const expiresAt = new Date(expiryYear, 6, 3).toISOString(); // 3 juillet

      const { data: newSession, error: sessErr } = await supabase
        .from('exam_sessions')
        .insert({
          code: sessionCode,
          scenario_name: data.scenarioName,
          date_oral: options.dateOral || null,
          type_oral: options.typeOral || 'dnb',
          expires_at: expiresAt,
        })
        .select('id')
        .single();

      if (sessErr || !newSession) {
        return { success: false, error: `Erreur création session: ${sessErr?.message}` };
      }

      sessionId = newSession.id;
    }

    // 3. Créer les jurys
    for (let juryIdx = 0; juryIdx < data.jurys.length; juryIdx++) {
      const jury = data.jurys[juryIdx]!;
      const juryNumber = juryIdx + 1;

      // Déterminer le mode (duo par défaut si 2+ enseignants)
      const mode = jury.enseignants.length >= 2 ? 'duo' : 'solo';

      const { data: newJury, error: juryErr } = await supabase
        .from('session_jurys')
        .insert({
          session_id: sessionId,
          jury_number: juryNumber,
          jury_name: jury.juryName,
          salle: jury.salle || null,
          mode,
          capacity: jury.capaciteMax,
        })
        .select('id')
        .single();

      if (juryErr || !newJury) {
        console.error(`[supabaseUpload] Erreur jury ${jury.juryName}:`, juryErr);
        continue;
      }

      // 4. Créer les élèves pseudonymisés
      await uploadJuryEleves(newJury.id, jury, data.jurys);
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[supabaseUpload] Erreur:', err);
    return { success: false, error: message };
  }
}

/**
 * Upload les élèves d'un jury (pseudonymisés)
 */
async function uploadJuryEleves(
  juryId: string,
  jury: ExportJuryData,
  allJurys: ExportJuryData[]
): Promise<void> {
  // Construire un map des binômes pour résoudre les binome_id
  const eleveBinomeMap = new Map<string, string>();
  for (const j of allJurys) {
    for (const e of j.eleves) {
      if (e.binomeNom) {
        eleveBinomeMap.set(e.eleveId, e.binomeNom);
      }
    }
  }

  const rows = jury.eleves.map((eleve: ExportEleveData, idx: number) => ({
    jury_id: juryId,
    display_name: pseudonymize(eleve.prenom, eleve.nom),
    classe: eleve.classe,
    parcours: eleve.parcoursOral || null,
    sujet: eleve.sujetOral || null,
    ordre_passage: idx + 1,
    heure_passage: eleve.heurePassage || null,
    binome_id: null, // On ne peut pas résoudre le binome_id cross-jury facilement, sera null
    status: 'pending',
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from('session_eleves').insert(rows);
    if (error) {
      console.error(`[supabaseUpload] Erreur élèves jury ${jury.juryName}:`, error);
    }
  }
}
