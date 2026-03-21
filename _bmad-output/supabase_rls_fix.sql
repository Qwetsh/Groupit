-- ============================================================
-- FIX RLS : Ajouter les policies DELETE manquantes
-- + UPDATE sur exam_sessions
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- DELETE sur exam_sessions (pour reset test depuis la PWA)
CREATE POLICY "sessions_delete" ON exam_sessions
  FOR DELETE USING (true);

-- DELETE sur session_jurys (pour re-upload depuis Groupit)
CREATE POLICY "jurys_delete" ON session_jurys
  FOR DELETE USING (true);

-- DELETE sur session_eleves (cascade quand on supprime les jurys, ou directement)
CREATE POLICY "eleves_delete" ON session_eleves
  FOR DELETE USING (true);

-- DELETE sur jury_members (quand un juré quitte)
CREATE POLICY "members_delete" ON jury_members
  FOR DELETE USING (user_id = auth.uid());

-- DELETE sur evaluations (cleanup)
CREATE POLICY "evaluations_delete" ON evaluations
  FOR DELETE USING (true);

-- DELETE sur final_scores (cleanup)
CREATE POLICY "final_delete" ON final_scores
  FOR DELETE USING (true);

-- UPDATE sur exam_sessions (pour mettre à jour scenario_name/date_oral)
CREATE POLICY "sessions_update" ON exam_sessions
  FOR UPDATE USING (true);

-- SELECT sur jury_members : permettre aussi aux non-membres de voir
-- (nécessaire pour le dashboard qui charge les members count)
-- Note : si la policy existante est trop restrictive, on la remplace
DROP POLICY IF EXISTS "members_select" ON jury_members;
CREATE POLICY "members_select" ON jury_members
  FOR SELECT USING (true);

-- SELECT sur session_eleves : ouvrir pour le dashboard aussi
DROP POLICY IF EXISTS "eleves_select" ON session_eleves;
CREATE POLICY "eleves_select" ON session_eleves
  FOR SELECT USING (true);

-- SELECT sur evaluations : ouvrir pour le dashboard
DROP POLICY IF EXISTS "evaluations_select" ON evaluations;
CREATE POLICY "evaluations_select" ON evaluations
  FOR SELECT USING (true);

-- SELECT sur final_scores : ouvrir pour le dashboard
DROP POLICY IF EXISTS "final_select" ON final_scores;
CREATE POLICY "final_select" ON final_scores
  FOR SELECT USING (true);
