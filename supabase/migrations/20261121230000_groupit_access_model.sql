-- ============================================================
-- GROUPIT — Modèle d'accès du schéma `groupit`
-- ============================================================
--
-- Avant : toute personne disposant de la clé publique pouvait lire, modifier
-- et supprimer toutes les sessions, tous les élèves et toutes les notes.
--
-- Après :
--   * rien n'est accessible sans connaître le code d'une session ;
--   * le code se présente à une fonction (jamais à une table) : on ne peut
--     plus lister les sessions, et les essais ratés sont limités ;
--   * un jury ne lit et n'écrit que ses propres élèves, et plus rien une fois
--     la session verrouillée ;
--   * seul le navigateur qui a créé une session peut la réexporter (ce qui
--     remplace ses jurys) ;
--   * le rôle `anon` (visiteur non connecté) n'a plus aucun droit.
--
-- Rôles :
--   owner     : a créé la session depuis l'application principale
--   dashboard : a ouvert le tableau de bord avec le code de session
--   jury      : a rejoint un jury avec le code et le numéro de jury
--
-- À savoir pour la suite : toute nouvelle fonction créée dans ce schéma est
-- exécutable par tout le monde par défaut (règle de PostgreSQL). Il faut lui
-- retirer ce droit explicitement, comme en bas de ce fichier.

-- ------------------------------------------------------------
-- 1. Tables de contrôle d'accès
-- ------------------------------------------------------------

create table groupit.session_access (
  session_id uuid not null references groupit.exam_sessions(id) on delete cascade,
  user_id    uuid not null,
  role       text not null check (role in ('owner', 'dashboard')),
  granted_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index idx_grp_session_access_user on groupit.session_access (user_id);
alter table groupit.session_access enable row level security;

-- Essais ratés (code inconnu), pour limiter la recherche de codes par tâtonnement.
create table groupit.access_failures (
  id        bigint generated always as identity primary key,
  user_id   uuid not null,
  failed_at timestamptz not null default now()
);
create index idx_grp_access_failures_user on groupit.access_failures (user_id, failed_at);
alter table groupit.access_failures enable row level security;
-- Aucune politique : seules les fonctions ci-dessous y touchent.

-- ------------------------------------------------------------
-- 2. Anciennes politiques et fonctions
-- ------------------------------------------------------------

drop policy if exists grp_sessions_select    on groupit.exam_sessions;
drop policy if exists grp_sessions_insert    on groupit.exam_sessions;
drop policy if exists grp_sessions_update    on groupit.exam_sessions;
drop policy if exists grp_sessions_delete    on groupit.exam_sessions;
drop policy if exists grp_jurys_select       on groupit.session_jurys;
drop policy if exists grp_jurys_insert       on groupit.session_jurys;
drop policy if exists grp_jurys_update       on groupit.session_jurys;
drop policy if exists grp_jurys_delete       on groupit.session_jurys;
drop policy if exists grp_eleves_select      on groupit.session_eleves;
drop policy if exists grp_eleves_insert      on groupit.session_eleves;
drop policy if exists grp_eleves_update      on groupit.session_eleves;
drop policy if exists grp_eleves_delete      on groupit.session_eleves;
drop policy if exists grp_members_select     on groupit.jury_members;
drop policy if exists grp_members_insert     on groupit.jury_members;
drop policy if exists grp_members_delete     on groupit.jury_members;
drop policy if exists grp_evaluations_select on groupit.evaluations;
drop policy if exists grp_evaluations_insert on groupit.evaluations;
drop policy if exists grp_evaluations_update on groupit.evaluations;
drop policy if exists grp_evaluations_delete on groupit.evaluations;
drop policy if exists grp_final_select       on groupit.final_scores;
drop policy if exists grp_final_insert       on groupit.final_scores;
drop policy if exists grp_final_update       on groupit.final_scores;
drop policy if exists grp_final_delete       on groupit.final_scores;

-- `my_jury_id()` et `my_slot()` renvoyaient « un » jury au hasard quand la
-- même personne en avait rejoint plusieurs : remplacées par des fonctions
-- qui prennent le jury en paramètre.
drop function if exists groupit.my_jury_id();
drop function if exists groupit.my_slot();

-- ------------------------------------------------------------
-- 3. Fonctions internes (non exposées aux clients)
-- ------------------------------------------------------------

create function groupit._jury_session_id(p_jury_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select session_id from groupit.session_jurys where id = p_jury_id;
$$;

create function groupit._eleve_jury_id(p_eleve_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select jury_id from groupit.session_eleves where id = p_eleve_id;
$$;

create function groupit._session_locked(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select locked from groupit.exam_sessions where id = p_session_id), true);
$$;

create function groupit._my_slot_in(p_jury_id uuid) returns character
language sql stable security definer set search_path = '' as $$
  select slot from groupit.jury_members
  where jury_id = p_jury_id and user_id = (select auth.uid());
$$;

create function groupit._throttled(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) >= 8 from groupit.access_failures
  where user_id = p_user_id and failed_at > now() - interval '10 minutes';
$$;

-- Fin de validité d'une session : le 3 juillet qui clôt l'année scolaire en cours.
create function groupit._school_year_end() returns timestamptz
language sql stable set search_path = '' as $$
  select make_timestamptz(
    extract(year from now())::int + case when extract(month from now()) >= 7 then 1 else 0 end,
    7, 3, 0, 0, 0, 'Europe/Paris');
$$;

-- ------------------------------------------------------------
-- 4. Fonctions utilisées par les politiques
--    (elles ne révèlent qu'un oui/non sur l'appelant lui-même)
-- ------------------------------------------------------------

create function groupit.has_session_access(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from groupit.session_access
    where session_id = p_session_id and user_id = (select auth.uid())
  );
$$;

create function groupit.is_session_owner(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from groupit.session_access
    where session_id = p_session_id and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

create or replace function groupit.is_jury_member(p_jury_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from groupit.jury_members
    where jury_id = p_jury_id and user_id = (select auth.uid())
  );
$$;

create function groupit.can_read_session(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select groupit.has_session_access(p_session_id) or exists (
    select 1
    from groupit.jury_members m
    join groupit.session_jurys j on j.id = m.jury_id
    where j.session_id = p_session_id and m.user_id = (select auth.uid())
  );
$$;

create function groupit.owns_jury_session(p_jury_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select groupit.is_session_owner(groupit._jury_session_id(p_jury_id));
$$;

create function groupit.can_read_jury(p_jury_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select groupit.is_jury_member(p_jury_id)
      or groupit.has_session_access(groupit._jury_session_id(p_jury_id));
$$;

create function groupit.can_write_jury(p_jury_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select groupit.is_jury_member(p_jury_id)
     and not groupit._session_locked(groupit._jury_session_id(p_jury_id));
$$;

create function groupit.can_read_eleve(p_eleve_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select groupit.can_read_jury(groupit._eleve_jury_id(p_eleve_id));
$$;

create function groupit.can_write_eleve(p_eleve_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select groupit.can_write_jury(groupit._eleve_jury_id(p_eleve_id));
$$;

create function groupit.can_write_evaluation(p_eleve_id uuid, p_slot character) returns boolean
language sql stable security definer set search_path = '' as $$
  select groupit.can_write_eleve(p_eleve_id)
     and p_slot = groupit._my_slot_in(groupit._eleve_jury_id(p_eleve_id));
$$;

-- ------------------------------------------------------------
-- 5. Points d'entrée : le code de session se présente ici
-- ------------------------------------------------------------

-- Application principale : crée la session, ou la reprend pour un nouvel export.
create function groupit.claim_session(p_code text, p_scenario_name text, p_date_oral date)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text := upper(btrim(coalesce(p_code, '')));
  v_session groupit.exam_sessions%rowtype;
  v_scores  integer;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  if v_code !~ '^[A-Z0-9]{4,8}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code_format');
  end if;
  if groupit._throttled(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  select * into v_session from groupit.exam_sessions where code = v_code for update;

  if not found then
    if (select count(*) from groupit.session_access where user_id = v_uid and role = 'owner') >= 30 then
      return jsonb_build_object('ok', false, 'reason', 'too_many_sessions');
    end if;
    insert into groupit.exam_sessions (code, scenario_name, date_oral, expires_at)
    values (v_code, p_scenario_name, p_date_oral, groupit._school_year_end())
    returning * into v_session;
    insert into groupit.session_access (session_id, user_id, role)
    values (v_session.id, v_uid, 'owner');
    return jsonb_build_object('ok', true, 'session_id', v_session.id, 'created', true);
  end if;

  if not exists (
    select 1 from groupit.session_access
    where session_id = v_session.id and user_id = v_uid and role = 'owner'
  ) then
    -- Révèle qu'un code existe : compte comme un essai.
    insert into groupit.access_failures (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  select count(*) into v_scores
  from groupit.final_scores f
  join groupit.session_eleves e on e.id = f.eleve_id
  join groupit.session_jurys j on j.id = e.jury_id
  where j.session_id = v_session.id;

  if v_scores > 0 then
    return jsonb_build_object('ok', false, 'reason', 'has_scores', 'score_count', v_scores);
  end if;

  update groupit.exam_sessions
  set scenario_name = p_scenario_name, date_oral = p_date_oral
  where id = v_session.id;

  -- Les élèves et les membres de jury partent avec leurs jurys (CASCADE).
  delete from groupit.session_jurys where session_id = v_session.id;

  return jsonb_build_object('ok', true, 'session_id', v_session.id, 'created', false);
end;
$$;

-- Application principale : nombre de notes d'une session dont on est propriétaire.
-- Renvoie 0 pour un code inconnu ou qui appartient à quelqu'un d'autre.
create function groupit.owned_session_score_count(p_code text) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from groupit.exam_sessions s
  join groupit.session_access a on a.session_id = s.id
  join groupit.session_jurys j on j.session_id = s.id
  join groupit.session_eleves e on e.jury_id = j.id
  join groupit.final_scores f on f.eleve_id = e.id
  where s.code = upper(btrim(coalesce(p_code, '')))
    and a.user_id = (select auth.uid())
    and a.role = 'owner';
$$;

-- Application jury : rejoint un jury et obtient un emplacement (A ou B).
create function groupit.join_jury(p_code text, p_jury_number integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text := upper(btrim(coalesce(p_code, '')));
  v_session groupit.exam_sessions%rowtype;
  v_jury_id uuid;
  v_slot    character(1);
  v_oldest  uuid;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  if groupit._throttled(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  select * into v_session from groupit.exam_sessions
  where code = v_code and expires_at > now();
  if not found then
    insert into groupit.access_failures (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;
  if v_session.locked then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;

  -- Verrou sur le jury : deux personnes qui rejoignent en même temps ne
  -- peuvent pas obtenir le même emplacement.
  select id into v_jury_id from groupit.session_jurys
  where session_id = v_session.id and jury_number = p_jury_number
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'jury_not_found');
  end if;

  select slot into v_slot from groupit.jury_members
  where jury_id = v_jury_id and user_id = v_uid;

  if v_slot is null then
    select s.slot into v_slot
    from (values ('A'::character(1)), ('B'::character(1))) as s(slot)
    where not exists (
      select 1 from groupit.jury_members m where m.jury_id = v_jury_id and m.slot = s.slot
    )
    order by s.slot
    limit 1;

    if v_slot is null then
      -- Les deux emplacements sont pris : le plus ancien cède sa place
      -- (cas d'un enseignant qui change d'appareil).
      select id, slot into v_oldest, v_slot from groupit.jury_members
      where jury_id = v_jury_id
      order by joined_at asc
      limit 1;
      delete from groupit.jury_members where id = v_oldest;
    end if;

    insert into groupit.jury_members (jury_id, user_id, slot)
    values (v_jury_id, v_uid, v_slot);
  end if;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'jury_id', v_jury_id,
    'slot', v_slot,
    'criteria_config', v_session.criteria_config
  );
end;
$$;

-- Tableau de bord : ouvre une session avec son code.
create function groupit.open_dashboard(p_code text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := auth.uid();
  v_code       text := upper(btrim(coalesce(p_code, '')));
  v_session_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  if groupit._throttled(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  select id into v_session_id from groupit.exam_sessions
  where code = v_code and expires_at > now();
  if not found then
    insert into groupit.access_failures (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  insert into groupit.session_access (session_id, user_id, role)
  values (v_session_id, v_uid, 'dashboard')
  on conflict (session_id, user_id) do nothing;

  return jsonb_build_object('ok', true, 'session_id', v_session_id);
end;
$$;

-- Nettoyage horaire (pg_cron) : sessions expirées et vieux essais ratés.
create or replace function groupit.cleanup_expired_sessions() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  deleted_count integer;
begin
  delete from groupit.exam_sessions where expires_at < now();
  get diagnostics deleted_count = row_count;
  delete from groupit.access_failures where failed_at < now() - interval '1 day';
  return deleted_count;
end;
$$;

-- ------------------------------------------------------------
-- 6. Politiques
--    Les politiques s'appuient sur les colonnes de la ligne elle-même :
--    une ligne tout juste insérée n'est pas encore visible des fonctions.
-- ------------------------------------------------------------

-- Sessions : lecture par les participants ; verrou et grille par le tableau de bord.
-- Création et suppression passent par `claim_session` et par le nettoyage.
create policy grp_sessions_select on groupit.exam_sessions
  for select to authenticated using (groupit.can_read_session(id));
create policy grp_sessions_update on groupit.exam_sessions
  for update to authenticated
  using (groupit.has_session_access(id)) with check (groupit.has_session_access(id));

-- Jurys : créés par le propriétaire de la session.
create policy grp_jurys_select on groupit.session_jurys
  for select to authenticated
  using (groupit.is_jury_member(id) or groupit.has_session_access(session_id));
create policy grp_jurys_insert on groupit.session_jurys
  for insert to authenticated with check (groupit.is_session_owner(session_id));

-- Élèves : créés par le propriétaire, suivis par leur jury tant que la session est ouverte.
create policy grp_eleves_select on groupit.session_eleves
  for select to authenticated using (groupit.can_read_jury(jury_id));
create policy grp_eleves_insert on groupit.session_eleves
  for insert to authenticated with check (groupit.owns_jury_session(jury_id));
create policy grp_eleves_update on groupit.session_eleves
  for update to authenticated
  using (groupit.can_write_jury(jury_id)) with check (groupit.can_write_jury(jury_id));

-- Membres de jury : lecture seule ; l'inscription passe par `join_jury`.
create policy grp_members_select on groupit.jury_members
  for select to authenticated using (groupit.can_read_jury(jury_id));

-- Évaluations : chaque juré écrit la sienne (son emplacement, ses élèves).
create policy grp_evaluations_select on groupit.evaluations
  for select to authenticated using (groupit.can_read_eleve(eleve_id));
create policy grp_evaluations_insert on groupit.evaluations
  for insert to authenticated
  with check (groupit.can_write_evaluation(eleve_id, juror_slot));
create policy grp_evaluations_update on groupit.evaluations
  for update to authenticated
  using (groupit.can_write_evaluation(eleve_id, juror_slot))
  with check (groupit.can_write_evaluation(eleve_id, juror_slot));

-- Notes finales : écrites par le jury de l'élève.
create policy grp_final_select on groupit.final_scores
  for select to authenticated using (groupit.can_read_eleve(eleve_id));
create policy grp_final_insert on groupit.final_scores
  for insert to authenticated with check (groupit.can_write_eleve(eleve_id));
create policy grp_final_update on groupit.final_scores
  for update to authenticated
  using (groupit.can_write_eleve(eleve_id)) with check (groupit.can_write_eleve(eleve_id));

-- Droits d'accès : chacun voit les siens.
create policy grp_access_select on groupit.session_access
  for select to authenticated using (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- 7. Droits : le strict nécessaire, et rien pour les visiteurs non connectés
-- ------------------------------------------------------------

revoke all on all tables    in schema groupit from public, anon, authenticated;
revoke all on all sequences in schema groupit from public, anon, authenticated;
revoke all on all functions in schema groupit from public, anon, authenticated;
revoke usage on schema groupit from anon;

grant select                                 on groupit.exam_sessions  to authenticated;
grant update (criteria_config, locked)       on groupit.exam_sessions  to authenticated;
grant select, insert                         on groupit.session_jurys  to authenticated;
grant select, insert                         on groupit.session_eleves to authenticated;
grant update (status, duree_passage)         on groupit.session_eleves to authenticated;
grant select                                 on groupit.jury_members   to authenticated;
grant select, insert, update                 on groupit.evaluations    to authenticated;
grant select, insert, update                 on groupit.final_scores   to authenticated;
grant select                                 on groupit.session_access to authenticated;

grant execute on function groupit.has_session_access(uuid)              to authenticated;
grant execute on function groupit.is_session_owner(uuid)                to authenticated;
grant execute on function groupit.is_jury_member(uuid)                  to authenticated;
grant execute on function groupit.can_read_session(uuid)                to authenticated;
grant execute on function groupit.owns_jury_session(uuid)               to authenticated;
grant execute on function groupit.can_read_jury(uuid)                   to authenticated;
grant execute on function groupit.can_write_jury(uuid)                  to authenticated;
grant execute on function groupit.can_read_eleve(uuid)                  to authenticated;
grant execute on function groupit.can_write_eleve(uuid)                 to authenticated;
grant execute on function groupit.can_write_evaluation(uuid, character) to authenticated;
grant execute on function groupit.claim_session(text, text, date)       to authenticated;
grant execute on function groupit.owned_session_score_count(text)       to authenticated;
grant execute on function groupit.join_jury(text, integer)              to authenticated;
grant execute on function groupit.open_dashboard(text)                  to authenticated;

-- Les futures tables du schéma ne seront plus ouvertes par défaut.
alter default privileges for role postgres in schema groupit
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema groupit
  revoke all on sequences from anon, authenticated;
