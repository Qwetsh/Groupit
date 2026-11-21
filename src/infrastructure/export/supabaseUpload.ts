// ============================================================
// SUPABASE UPLOAD — Push session data for jury PWA + dashboard
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { ExportResultData, ExportJuryData, ExportEleveData, PdfExportOptions } from './types';

// Variables d'environnement Vite — OBLIGATOIRES (pas de fallback hardcodé)
// Accès direct pour que Vite puisse les remplacer statiquement au build
const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[supabaseUpload] Variables d\'environnement manquantes: VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont obligatoires.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'groupit' },
});

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
 * Garantit une connexion anonyme en réutilisant celle du navigateur.
 * Cette identité est la « propriétaire » des sessions créées ici : c'est
 * elle qui a le droit de les réexporter.
 */
async function ensureSignedIn(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`Connexion impossible : ${error.message}`);
}

/** Messages affichés quand le serveur refuse de créer ou de reprendre une session. */
function claimRefusalMessage(reason: string, scoreCount = 0): string {
  switch (reason) {
    case 'invalid_code_format':
      return 'Le code de session doit comporter entre 4 et 8 lettres ou chiffres.';
    case 'not_owner':
      return 'Ce code de session est déjà utilisé depuis un autre navigateur. Choisissez un autre code.';
    case 'has_scores':
      return `Cette session contient ${scoreCount} note(s) déjà enregistrée(s). Utilisez un nouveau code de session pour ne pas les perdre.`;
    case 'too_many_attempts':
      return "Trop d'essais. Patientez une dizaine de minutes avant de réessayer.";
    case 'too_many_sessions':
      return 'Trop de sessions ouvertes depuis ce navigateur.';
    default:
      return 'Le serveur a refusé la création de la session.';
  }
}

/**
 * Vérifie si une session créée depuis ce navigateur a déjà des notes
 * enregistrées. Un code inconnu ou appartenant à quelqu'un d'autre compte
 * pour zéro : le serveur ne dit rien des sessions des autres.
 */
export async function checkSessionHasScores(sessionCode: string): Promise<{ hasScores: boolean; count: number }> {
  try {
    await ensureSignedIn();
    const { data, error } = await supabase.rpc('owned_session_score_count', {
      p_code: sessionCode.toUpperCase().slice(0, 8),
    });
    if (error) return { hasScores: false, count: 0 };
    const count = typeof data === 'number' ? data : 0;
    return { hasScores: count > 0, count };
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
    // 1. Connexion anonyme (réutilisée d'un export à l'autre)
    await ensureSignedIn();

    // Code session limité à 8 chars (VARCHAR(8) en DB)
    const sessionCode = options.sessionCode.toUpperCase().slice(0, 8);

    // 2. Créer la session, ou la reprendre si elle nous appartient.
    // Le serveur refuse la reprise si des notes existent, et retire les
    // anciens jurys sinon (les élèves partent avec, en cascade).
    const { data: claim, error: claimErr } = await supabase.rpc('claim_session', {
      p_code: sessionCode,
      p_scenario_name: data.scenarioName,
      p_date_oral: options.dateOral || null,
    });

    if (claimErr || !claim) {
      console.error('[supabaseUpload] Erreur claim_session:', claimErr);
      return { success: false, error: `Erreur création session: ${claimErr?.message ?? 'réponse vide'}` };
    }
    if (!claim.ok) {
      return { success: false, error: claimRefusalMessage(claim.reason, claim.score_count) };
    }

    const sessionId: string = claim.session_id;

    // 3. Pré-calculer les tailles de groupes pour inclure groupe_oral_id dès l'INSERT
    const groupSizes = new Map<string, number>();
    for (const jury of data.jurys) {
      for (const eleve of jury.eleves) {
        if (eleve.groupeOralId) {
          groupSizes.set(eleve.groupeOralId, (groupSizes.get(eleve.groupeOralId) || 0) + 1);
        }
      }
    }
    if (groupSizes.size > 0) {
      console.log(`[supabaseUpload] ${groupSizes.size} groupes détectés (${[...groupSizes.values()].reduce((a, b) => a + b, 0)} élèves)`);
    }

    // 4. Créer les jurys et élèves (avec groupe_oral_id directement dans l'INSERT)
    const failures: string[] = [];
    for (let juryIdx = 0; juryIdx < data.jurys.length; juryIdx++) {
      const jury = data.jurys[juryIdx]!;
      const juryNumber = juryIdx + 1;
      const hasGroupes = jury.eleves.some(e => e.groupeOralId);

      // Noms des enseignants et suppléant(s)
      const enseignantsNames = jury.enseignants.map(e => `${e.prenom} ${e.nom}`).join(', ') || null;
      const suppleantName = jury.suppleants?.map(e => `${e.prenom} ${e.nom}`).join(', ') || null;

      const { data: newJury, error: juryErr } = await supabase
        .from('session_jurys')
        .insert({
          session_id: sessionId,
          jury_number: juryNumber,
          jury_name: jury.juryName,
          salle: jury.salle || null,
          mode: hasGroupes ? 'collectif' : 'solo',
          enseignants_names: enseignantsNames,
          suppleant_name: suppleantName,
        })
        .select('id')
        .single();

      if (juryErr || !newJury) {
        console.error(`[supabaseUpload] Erreur jury ${jury.juryName}:`, juryErr);
        failures.push(jury.juryName);
        continue;
      }

      const elevesOk = await uploadJuryEleves(newJury.id, jury);
      if (!elevesOk) failures.push(jury.juryName);
    }

    if (failures.length > 0) {
      return {
        success: false,
        error: `La session est incomplète : ${failures.join(', ')} n'a pas pu être enregistré. Relancez l'export.`,
      };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[supabaseUpload] Erreur:', err);
    return { success: false, error: message };
  }
}

/**
 * Upload les élèves d'un jury (pseudonymisés avec hash).
 * Inclut groupe_oral_id et duree_passage directement dans l'INSERT
 * pour éviter les conflits RLS sur UPDATE.
 */
async function uploadJuryEleves(
  juryId: string,
  jury: ExportJuryData,
): Promise<boolean> {
  if (jury.eleves.length === 0) return true;

  const rows = await Promise.all(
    jury.eleves.map(async (eleve: ExportEleveData, idx: number) => {
      return {
        jury_id: juryId,
        eleve_hash: await hashEleve(eleve.nom, eleve.prenom, eleve.classe),
        display_name: pseudonymize(eleve.prenom, eleve.nom),
        classe: eleve.classe,
        parcours: eleve.parcoursOral || null,
        sujet: eleve.sujetOral || null,
        langue: eleve.langueEtrangere || null,
        groupe_oral_id: eleve.groupeOralId || null,
        duree_passage: null, // Mesuré par le chronomètre in-app
        ordre_passage: idx + 1,
        heure_passage: eleve.heurePassage || null,
        status: 'pending',
      };
    })
  );

  const { error } = await supabase
    .from('session_eleves')
    .insert(rows);

  if (error) {
    console.error(`[supabaseUpload] Erreur élèves jury ${jury.juryName}:`, error);
    return false;
  }
  return true;
}
