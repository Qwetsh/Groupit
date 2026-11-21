-- ============================================================
-- GROUPIT — Code direction pour le tableau de bord
-- ============================================================
--
-- Le code de session figure sur les convocations des enseignants : il ne
-- peut pas protéger à lui seul le tableau de bord, qui montre toutes les
-- notes et permet de verrouiller la session.
--
-- Chaque session reçoit donc un second code, tiré au hasard par le serveur
-- et remis uniquement à la personne qui crée la session. Il est demandé
-- pour ouvrir le tableau de bord depuis un autre poste que celui qui a créé
-- la session.

create table groupit.session_secrets (
  session_id     uuid primary key references groupit.exam_sessions(id) on delete cascade,
  direction_code text not null,
  created_at     timestamptz not null default now()
);
alter table groupit.session_secrets enable row level security;
revoke all on groupit.session_secrets from public, anon, authenticated;
-- Aucune politique : seules les fonctions ci-dessous y touchent.

-- 8 caractères sans ambiguïté à la lecture (ni 0/O, ni 1/I/L).
create function groupit._new_direction_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(r.b, i) % 31), 1), '')
  from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) as i;
$$;

-- Tolère les minuscules, les espaces et les tirets à la saisie.
create function groupit._normalize_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
$$;

-- Création ou reprise d'une session : renvoie aussi le code direction.
create or replace function groupit.claim_session(p_code text, p_scenario_name text, p_date_oral date)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := auth.uid();
  v_code      text := upper(btrim(coalesce(p_code, '')));
  v_session   groupit.exam_sessions%rowtype;
  v_scores    integer;
  v_direction text;
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
    v_direction := groupit._new_direction_code();
    insert into groupit.session_secrets (session_id, direction_code)
    values (v_session.id, v_direction);
    return jsonb_build_object(
      'ok', true, 'session_id', v_session.id, 'created', true, 'direction_code', v_direction);
  end if;

  if not exists (
    select 1 from groupit.session_access
    where session_id = v_session.id and user_id = v_uid and role = 'owner'
  ) then
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

  delete from groupit.session_jurys where session_id = v_session.id;

  insert into groupit.session_secrets (session_id, direction_code)
  values (v_session.id, groupit._new_direction_code())
  on conflict (session_id) do nothing;
  select direction_code into v_direction
  from groupit.session_secrets where session_id = v_session.id;

  return jsonb_build_object(
    'ok', true, 'session_id', v_session.id, 'created', false, 'direction_code', v_direction);
end;
$$;

-- Le propriétaire d'une session peut retrouver son code direction.
-- Renvoie NULL pour un code inconnu ou qui appartient à quelqu'un d'autre.
create function groupit.get_direction_code(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select sec.direction_code
  from groupit.exam_sessions s
  join groupit.session_access a on a.session_id = s.id
  join groupit.session_secrets sec on sec.session_id = s.id
  where s.code = upper(btrim(coalesce(p_code, '')))
    and a.user_id = (select auth.uid())
    and a.role = 'owner';
$$;

-- Tableau de bord : le code de session ne suffit plus.
drop function groupit.open_dashboard(text);

create function groupit.open_dashboard(p_code text, p_direction_code text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := auth.uid();
  v_code       text := upper(btrim(coalesce(p_code, '')));
  v_given      text := groupit._normalize_code(p_direction_code);
  v_session_id uuid;
  v_expected   text;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  if groupit._throttled(v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  select id into v_session_id from groupit.exam_sessions
  where code = v_code and expires_at > now();

  -- Déjà autorisé (poste qui a créé la session, ou code direction déjà saisi).
  if v_session_id is not null and exists (
    select 1 from groupit.session_access
    where session_id = v_session_id and user_id = v_uid
  ) then
    return jsonb_build_object('ok', true, 'session_id', v_session_id);
  end if;

  -- Sans code direction, même réponse que la session existe ou non :
  -- on ne peut pas s'en servir pour deviner les codes de session.
  if v_given = '' then
    return jsonb_build_object('ok', false, 'reason', 'direction_code_required');
  end if;

  if v_session_id is not null then
    select direction_code into v_expected
    from groupit.session_secrets where session_id = v_session_id;
  end if;

  if v_expected is null or v_expected <> v_given then
    insert into groupit.access_failures (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  insert into groupit.session_access (session_id, user_id, role)
  values (v_session_id, v_uid, 'dashboard')
  on conflict (session_id, user_id) do nothing;

  return jsonb_build_object('ok', true, 'session_id', v_session_id);
end;
$$;

revoke all on function groupit._new_direction_code()        from public, anon, authenticated;
revoke all on function groupit._normalize_code(text)        from public, anon, authenticated;
revoke all on function groupit.get_direction_code(text)     from public, anon;
revoke all on function groupit.open_dashboard(text, text)   from public, anon;
grant execute on function groupit.get_direction_code(text)   to authenticated;
grant execute on function groupit.open_dashboard(text, text) to authenticated;
