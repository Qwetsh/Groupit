-- ============================================================
-- MIGRATION: Langue étrangère + Groupes oraux (binômes/trinômes)
-- Date: 2026-03-31
-- ============================================================

-- 1. Ajout colonne langue étrangère
ALTER TABLE session_eleves
  ADD COLUMN IF NOT EXISTS langue TEXT DEFAULT NULL;

-- 2. Renommage binome_id → groupe_oral_id
ALTER TABLE session_eleves
  RENAME COLUMN binome_id TO groupe_oral_id;

-- 3. Commentaires pour documentation
COMMENT ON COLUMN session_eleves.langue IS 'Langue étrangère choisie pour l''oral DNB (ex: Anglais, Espagnol)';
COMMENT ON COLUMN session_eleves.groupe_oral_id IS 'UUID partagé par les membres d''un groupe oral (2 ou 3 élèves)';
