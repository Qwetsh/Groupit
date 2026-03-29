-- ============================================================
-- GROUPIT JURY — Schéma Supabase
-- Exécuter dans SQL Editor (supabase.com > SQL Editor > New query)
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Session d'examen (créée depuis Groupit lors de l'export)
CREATE TABLE exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) UNIQUE NOT NULL,        -- code court pour QR / saisie manuelle
  scenario_name TEXT,
  date_oral DATE,
  criteria_config JSONB DEFAULT NULL,     -- grille de critères configurable (CriteriaConfig)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL          -- suppression auto RGPD
);

-- Jurys d'une session
CREATE TABLE session_jurys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  jury_number INT NOT NULL,
  jury_name TEXT NOT NULL,
  salle TEXT,
  mode VARCHAR(10) DEFAULT 'duo',          -- 'solo' ou 'duo'
  UNIQUE(session_id, jury_number)
);

-- Membres de jury connectés (lie auth.uid() à un jury + slot)
CREATE TABLE jury_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jury_id UUID NOT NULL REFERENCES session_jurys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  slot CHAR(1) NOT NULL,                   -- 'A' ou 'B'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(jury_id, slot),
  UNIQUE(jury_id, user_id)
);

-- Élèves affectés (données pseudonymisées)
CREATE TABLE session_eleves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jury_id UUID NOT NULL REFERENCES session_jurys(id) ON DELETE CASCADE,
  eleve_hash VARCHAR(64) NOT NULL,         -- SHA-256(nom+prenom+classe) pour matching retour
  display_name TEXT NOT NULL,              -- "Prénom N." uniquement
  classe VARCHAR(10),
  parcours TEXT,
  sujet TEXT,
  binome_id UUID REFERENCES session_eleves(id),  -- réf du binôme si passage collectif
  ordre_passage INT,
  heure_passage TEXT,
  duree_passage INT,                       -- durée du passage en secondes
  status TEXT DEFAULT 'pending'            -- pending | lobby | in_progress | scored | validated | absent
    CHECK (status IN ('pending', 'lobby', 'in_progress', 'scored', 'validated', 'absent'))
);

-- Notation individuelle par juré (avant réconciliation)
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES session_eleves(id) ON DELETE CASCADE,
  juror_slot CHAR(1) NOT NULL              -- 'A' ou 'B'
    CHECK (juror_slot IN ('A', 'B')),

  -- 6 critères de notation
  score_expression NUMERIC(3,1),           -- /2
  score_diaporama NUMERIC(3,1),            -- /4
  score_reactivite NUMERIC(3,1),           -- /2
  score_contenu NUMERIC(3,1),              -- /5
  score_structure NUMERIC(3,1),            -- /2
  score_engagement NUMERIC(3,1),           -- /5

  -- Totaux calculés
  total_oral NUMERIC(3,1),                 -- /8
  total_sujet NUMERIC(4,1),               -- /12
  total NUMERIC(4,1),                      -- /20

  -- Scores JSONB dynamiques (critères configurables)
  scores JSONB DEFAULT NULL,               -- {criterionId: value}

  -- Observations
  points_forts TEXT,
  axes_amelioration TEXT,

  submitted_at TIMESTAMPTZ,

  UNIQUE(eleve_id, juror_slot)
);

-- Note finale validée (après réconciliation entre les 2 jurés)
CREATE TABLE final_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES session_eleves(id) ON DELETE CASCADE,

  -- 6 critères legacy (nullable pour configs custom)
  score_expression NUMERIC(3,1),
  score_diaporama NUMERIC(3,1),
  score_reactivite NUMERIC(3,1),
  score_contenu NUMERIC(3,1),
  score_structure NUMERIC(3,1),
  score_engagement NUMERIC(3,1),

  -- Totaux
  total_oral NUMERIC(3,1),
  total_sujet NUMERIC(4,1),
  total NUMERIC(4,1) NOT NULL,

  -- Scores JSONB dynamiques (critères configurables)
  scores JSONB DEFAULT NULL,               -- {criterionId: value}

  -- Observations (fusionnées ou choisies)
  points_forts TEXT,
  axes_amelioration TEXT,

  validated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(eleve_id)
);

-- ============================================================
-- 2. INDEX pour performances
-- ============================================================

CREATE INDEX idx_session_jurys_session ON session_jurys(session_id);
CREATE INDEX idx_jury_members_jury ON jury_members(jury_id);
CREATE INDEX idx_jury_members_user ON jury_members(user_id);
CREATE INDEX idx_session_eleves_jury ON session_eleves(jury_id);
CREATE INDEX idx_evaluations_eleve ON evaluations(eleve_id);
CREATE INDEX idx_final_scores_eleve ON final_scores(eleve_id);
CREATE INDEX idx_exam_sessions_code ON exam_sessions(code);
CREATE INDEX idx_exam_sessions_expires ON exam_sessions(expires_at);

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_jurys ENABLE ROW LEVEL SECURITY;
ALTER TABLE jury_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_eleves ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_scores ENABLE ROW LEVEL SECURITY;

-- Helper : vérifie qu'un user est membre d'un jury
CREATE OR REPLACE FUNCTION is_jury_member(p_jury_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM jury_members
    WHERE jury_id = p_jury_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper : récupère le jury_id d'un user
CREATE OR REPLACE FUNCTION my_jury_id()
RETURNS UUID AS $$
  SELECT jury_id FROM jury_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper : récupère le slot d'un user
CREATE OR REPLACE FUNCTION my_slot()
RETURNS CHAR(1) AS $$
  SELECT slot FROM jury_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- === exam_sessions ===
-- Lecture : tout le monde peut lire (pour vérifier le code session)
CREATE POLICY "sessions_select" ON exam_sessions
  FOR SELECT USING (true);

-- Insert : depuis Groupit (via service role ou anon pour simplifier)
CREATE POLICY "sessions_insert" ON exam_sessions
  FOR INSERT WITH CHECK (true);

-- === session_jurys ===
-- Lecture : si membre du jury OU pour la recherche par code session
CREATE POLICY "jurys_select" ON session_jurys
  FOR SELECT USING (true);

-- Insert : création depuis Groupit
CREATE POLICY "jurys_insert" ON session_jurys
  FOR INSERT WITH CHECK (true);

-- Update : membres du jury uniquement (pour changer le mode solo/duo)
CREATE POLICY "jurys_update" ON session_jurys
  FOR UPDATE USING (is_jury_member(id));

-- === jury_members ===
-- Lecture : membres du même jury
CREATE POLICY "members_select" ON jury_members
  FOR SELECT USING (
    jury_id IN (SELECT jury_id FROM jury_members WHERE user_id = auth.uid())
  );

-- Insert : n'importe qui peut rejoindre (si slot libre)
CREATE POLICY "members_insert" ON jury_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- === session_eleves ===
-- Lecture : membres du jury uniquement
CREATE POLICY "eleves_select" ON session_eleves
  FOR SELECT USING (is_jury_member(jury_id));

-- Insert : création depuis Groupit
CREATE POLICY "eleves_insert" ON session_eleves
  FOR INSERT WITH CHECK (true);

-- Update : membres du jury (pour changer le status)
CREATE POLICY "eleves_update" ON session_eleves
  FOR UPDATE USING (is_jury_member(jury_id));

-- === evaluations ===
-- Lecture : membres du jury de l'élève (via session_eleves)
CREATE POLICY "evaluations_select" ON evaluations
  FOR SELECT USING (
    eleve_id IN (
      SELECT id FROM session_eleves WHERE jury_id = my_jury_id()
    )
  );

-- Insert : seulement pour son propre slot
CREATE POLICY "evaluations_insert" ON evaluations
  FOR INSERT WITH CHECK (
    juror_slot = my_slot()
    AND eleve_id IN (
      SELECT id FROM session_eleves WHERE jury_id = my_jury_id()
    )
  );

-- Update : seulement ses propres évaluations
CREATE POLICY "evaluations_update" ON evaluations
  FOR UPDATE USING (
    juror_slot = my_slot()
    AND eleve_id IN (
      SELECT id FROM session_eleves WHERE jury_id = my_jury_id()
    )
  );

-- === final_scores ===
-- Lecture : membres du jury
CREATE POLICY "final_select" ON final_scores
  FOR SELECT USING (
    eleve_id IN (
      SELECT id FROM session_eleves WHERE jury_id = my_jury_id()
    )
  );

-- Insert : membres du jury
CREATE POLICY "final_insert" ON final_scores
  FOR INSERT WITH CHECK (
    eleve_id IN (
      SELECT id FROM session_eleves WHERE jury_id = my_jury_id()
    )
  );

-- Update : membres du jury (réconciliation)
CREATE POLICY "final_update" ON final_scores
  FOR UPDATE USING (
    eleve_id IN (
      SELECT id FROM session_eleves WHERE jury_id = my_jury_id()
    )
  );

-- ============================================================
-- 4. FONCTION DE NETTOYAGE RGPD (suppression sessions expirées)
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM exam_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. CRON JOB — nettoyage automatique toutes les heures
--    (nécessite l'extension pg_cron, activée par défaut sur Supabase)
-- ============================================================

-- Active l'extension pg_cron si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Planifie le nettoyage toutes les heures
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 * * * *',
  $$SELECT cleanup_expired_sessions()$$
);

-- ============================================================
-- 6. REALTIME — activer sur les tables qui nécessitent la sync
-- ============================================================

-- Dans Supabase Dashboard : Database > Replication
-- Activer Realtime sur ces tables :
--   ✅ jury_members      (détecter quand le 2e juré rejoint)
--   ✅ session_eleves     (sync du status: lobby, in_progress, etc.)
--   ✅ evaluations        (détecter quand l'autre juré a terminé)
--   ✅ final_scores       (sync validation finale)
--
-- NE PAS activer sur :
--   ❌ exam_sessions      (pas besoin de temps réel)
--   ❌ session_jurys      (rarement modifié)

ALTER PUBLICATION supabase_realtime ADD TABLE jury_members;
ALTER PUBLICATION supabase_realtime ADD TABLE session_eleves;
ALTER PUBLICATION supabase_realtime ADD TABLE evaluations;
ALTER PUBLICATION supabase_realtime ADD TABLE final_scores;

-- ============================================================
-- 7. MIGRATION — Critères configurables (JSONB)
--    À exécuter sur les bases existantes
-- ============================================================

-- Ajouter criteria_config à exam_sessions
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS criteria_config JSONB DEFAULT NULL;

-- Ajouter scores JSONB aux evaluations
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT NULL;

-- Ajouter scores JSONB aux final_scores
ALTER TABLE final_scores ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT NULL;

-- Ajouter duree_passage à session_eleves (si pas déjà fait)
ALTER TABLE session_eleves ADD COLUMN IF NOT EXISTS duree_passage INT;

-- Rendre les colonnes legacy nullable dans final_scores
ALTER TABLE final_scores ALTER COLUMN score_expression DROP NOT NULL;
ALTER TABLE final_scores ALTER COLUMN score_diaporama DROP NOT NULL;
ALTER TABLE final_scores ALTER COLUMN score_reactivite DROP NOT NULL;
ALTER TABLE final_scores ALTER COLUMN score_contenu DROP NOT NULL;
ALTER TABLE final_scores ALTER COLUMN score_structure DROP NOT NULL;
ALTER TABLE final_scores ALTER COLUMN score_engagement DROP NOT NULL;
ALTER TABLE final_scores ALTER COLUMN total_oral DROP NOT NULL;
ALTER TABLE final_scores ALTER COLUMN total_sujet DROP NOT NULL;

-- Ajouter status 'absent' si contrainte CHECK trop restrictive
-- (ignorer si déjà fait)
ALTER TABLE session_eleves DROP CONSTRAINT IF EXISTS session_eleves_status_check;
ALTER TABLE session_eleves ADD CONSTRAINT session_eleves_status_check
  CHECK (status IN ('pending', 'lobby', 'in_progress', 'scored', 'validated', 'absent'));

-- Migration des données existantes : remplir scores JSONB depuis colonnes legacy
UPDATE evaluations SET scores = jsonb_build_object(
  'expression', score_expression,
  'diaporama', score_diaporama,
  'reactivite', score_reactivite,
  'contenu', score_contenu,
  'structure', score_structure,
  'engagement', score_engagement
) WHERE scores IS NULL AND score_expression IS NOT NULL;

UPDATE final_scores SET scores = jsonb_build_object(
  'expression', score_expression,
  'diaporama', score_diaporama,
  'reactivite', score_reactivite,
  'contenu', score_contenu,
  'structure', score_structure,
  'engagement', score_engagement
) WHERE scores IS NULL AND score_expression IS NOT NULL;

-- Ajouter policy UPDATE sur exam_sessions (pour sauvegarder criteria_config)
CREATE POLICY "sessions_update" ON exam_sessions
  FOR UPDATE USING (true);
