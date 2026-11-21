-- ============================================================
-- GROUPIT — La grille de critères d'une session doit être bien formée
-- ============================================================
--
-- Le tableau de bord et l'application jury lisent `criteria_config` sans
-- filet : une grille mal formée les fait planter pour toute la session.
-- Les applications valident déjà la grille avant de l'enregistrer ; cette
-- contrainte garantit la même chose pour une écriture qui ne passerait pas
-- par elles.

create function groupit.is_valid_criteria_config(p_config jsonb) returns boolean
language sql immutable set search_path = '' as $$
  -- `coalesce(..., false)` : une contrainte CHECK laisse passer NULL, et un
  -- champ absent donne NULL. `is distinct from` pour la même raison.
  select p_config is null or coalesce(
    jsonb_typeof(p_config) = 'object'
    and jsonb_typeof(p_config -> 'categories') = 'array'
    and jsonb_typeof(p_config -> 'criteria') = 'array'
    and jsonb_array_length(p_config -> 'categories') between 1 and 10
    and jsonb_array_length(p_config -> 'criteria') between 1 and 20
    and not exists (
      select 1 from jsonb_array_elements(p_config -> 'categories') as cat
      where jsonb_typeof(cat) is distinct from 'object'
         or jsonb_typeof(cat -> 'id') is distinct from 'string'
         or jsonb_typeof(cat -> 'label') is distinct from 'string'
    )
    and not exists (
      select 1 from jsonb_array_elements(p_config -> 'criteria') as c
      where jsonb_typeof(c) is distinct from 'object'
         or jsonb_typeof(c -> 'id') is distinct from 'string'
         or jsonb_typeof(c -> 'label') is distinct from 'string'
         or jsonb_typeof(c -> 'categoryId') is distinct from 'string'
         or jsonb_typeof(c -> 'max') is distinct from 'number'
         or jsonb_typeof(c -> 'levels') is distinct from 'array'
         or jsonb_array_length(c -> 'levels') = 0
         or exists (
           select 1 from jsonb_array_elements(c -> 'levels') as l
           where jsonb_typeof(l) is distinct from 'object'
              or jsonb_typeof(l -> 'value') is distinct from 'number'
         )
    ),
    false
  );
$$;

-- La contrainte s'exécute avec les droits de la personne qui écrit : elle
-- doit donc pouvoir appeler la fonction, qui ne révèle rien.
revoke all on function groupit.is_valid_criteria_config(jsonb) from public, anon;
grant execute on function groupit.is_valid_criteria_config(jsonb) to authenticated;

alter table groupit.exam_sessions
  add constraint exam_sessions_criteria_config_valid
  check (groupit.is_valid_criteria_config(criteria_config));
