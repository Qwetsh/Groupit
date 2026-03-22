-- ============================================================
-- FIX RLS POLICIES — Corrections sécurité Code Review 2026-03-22
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- ============================================================
-- FIX C2/H3: Policies DELETE (recréation safe)
-- ============================================================

-- Supprimer les anciennes policies si elles existent déjà
DROP POLICY IF EXISTS "sessions_delete" ON exam_sessions;
DROP POLICY IF EXISTS "jurys_delete" ON session_jurys;
DROP POLICY IF EXISTS "members_delete" ON jury_members;
DROP POLICY IF EXISTS "eleves_delete" ON session_eleves;
DROP POLICY IF EXISTS "evaluations_delete" ON evaluations;
DROP POLICY IF EXISTS "final_delete" ON final_scores;

-- Recréer proprement
CREATE POLICY "sessions_delete" ON exam_sessions
  FOR DELETE USING (false);

CREATE POLICY "jurys_delete" ON session_jurys
  FOR DELETE USING (false);

CREATE POLICY "members_delete" ON jury_members
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "eleves_delete" ON session_eleves
  FOR DELETE USING (false);

CREATE POLICY "evaluations_delete" ON evaluations
  FOR DELETE USING (
    juror_slot = my_slot()
    AND eleve_id IN (
      SELECT id FROM session_eleves WHERE jury_id = my_jury_id()
    )
  );

CREATE POLICY "final_delete" ON final_scores
  FOR DELETE USING (
    eleve_id IN (
      SELECT id FROM session_eleves WHERE jury_id = my_jury_id()
    )
  );

-- ============================================================
-- BONUS: CHECK constraints sur les scores
-- (ignore si déjà existants)
-- ============================================================

DO $$
BEGIN
  -- evaluations
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_score_expression') THEN
    ALTER TABLE evaluations ADD CONSTRAINT chk_score_expression CHECK (score_expression IS NULL OR (score_expression >= 0 AND score_expression <= 2));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_score_diaporama') THEN
    ALTER TABLE evaluations ADD CONSTRAINT chk_score_diaporama CHECK (score_diaporama IS NULL OR (score_diaporama >= 0 AND score_diaporama <= 4));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_score_reactivite') THEN
    ALTER TABLE evaluations ADD CONSTRAINT chk_score_reactivite CHECK (score_reactivite IS NULL OR (score_reactivite >= 0 AND score_reactivite <= 2));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_score_contenu') THEN
    ALTER TABLE evaluations ADD CONSTRAINT chk_score_contenu CHECK (score_contenu IS NULL OR (score_contenu >= 0 AND score_contenu <= 5));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_score_structure') THEN
    ALTER TABLE evaluations ADD CONSTRAINT chk_score_structure CHECK (score_structure IS NULL OR (score_structure >= 0 AND score_structure <= 2));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_score_engagement') THEN
    ALTER TABLE evaluations ADD CONSTRAINT chk_score_engagement CHECK (score_engagement IS NULL OR (score_engagement >= 0 AND score_engagement <= 5));
  END IF;

  -- final_scores
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_final_expression') THEN
    ALTER TABLE final_scores ADD CONSTRAINT chk_final_expression CHECK (score_expression >= 0 AND score_expression <= 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_final_diaporama') THEN
    ALTER TABLE final_scores ADD CONSTRAINT chk_final_diaporama CHECK (score_diaporama >= 0 AND score_diaporama <= 4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_final_reactivite') THEN
    ALTER TABLE final_scores ADD CONSTRAINT chk_final_reactivite CHECK (score_reactivite >= 0 AND score_reactivite <= 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_final_contenu') THEN
    ALTER TABLE final_scores ADD CONSTRAINT chk_final_contenu CHECK (score_contenu >= 0 AND score_contenu <= 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_final_structure') THEN
    ALTER TABLE final_scores ADD CONSTRAINT chk_final_structure CHECK (score_structure >= 0 AND score_structure <= 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_final_engagement') THEN
    ALTER TABLE final_scores ADD CONSTRAINT chk_final_engagement CHECK (score_engagement >= 0 AND score_engagement <= 5);
  END IF;
END $$;
