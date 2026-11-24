-- TemoLima, cloud save v2: a player code that opens the same farm on any phone, and the progress filed in tables.
-- Applied to the Supabase project "MelaPress" (nxjwjklugmwnrlngzrub). Replaces 20261124224238; saves made under it are
-- carried over (their player id becomes the player code, and the phones that made them keep that id).
--
-- The player code is a random UUID made on the phone; it is the player's key to their farm (122 random bits: it
-- cannot be guessed). Every table is closed to the public API. The game reaches them only through two functions:
--   temolima_save(player, state, saved_at, records)  saves the farm and files the lists in their tables
--   temolima_restore(player)                         returns the saved farm, to open it on another phone

drop function if exists public.temolima_save(uuid, text, jsonb, timestamptz);
drop function if exists public.temolima_load(uuid, text);
alter table if exists public.temolima_saves rename to temolima_saves_v1;

-- the player: one row per player code, with the headline numbers
create table public.temolima_players (
  id uuid primary key,
  farmer_name text,
  farmer_look integer,
  country text,
  coins bigint not null default 0,
  points bigint not null default 0,
  level integer not null default 0,
  xp bigint not null default 0,
  season integer not null default 0,
  stage integer not null default 0,
  days_played integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  learning_credits integer not null default 0,
  levels_reached integer not null default 0,
  badges_won integer not null default 0,
  play_seconds bigint not null default 0,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
comment on table public.temolima_players is 'TemoLima players. id is the player code (shown in Settings, opens the farm on any phone): treat it as a secret.';

-- the whole save, as the game keeps it on the phone
create table public.temolima_saves (
  player_id uuid primary key references public.temolima_players (id) on delete cascade,
  state jsonb not null,
  client_saved_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.temolima_achievements (
  player_id uuid not null references public.temolima_players (id) on delete cascade,
  badge_id text not null,
  game text,
  tier text,
  title text,
  won_on date,
  claimed boolean not null default false,
  primary key (player_id, badge_id)
);

create table public.temolima_certificates (
  player_id uuid not null references public.temolima_players (id) on delete cascade,
  cert_id text not null,
  kind text not null,
  title text not null,
  line text,
  game text,
  issued_on date,
  primary key (player_id, cert_id)
);

-- My Progress: each module's learning credits and stage
create table public.temolima_learning_modules (
  player_id uuid not null references public.temolima_players (id) on delete cascade,
  module_id text not null,
  name text not null,
  credits integer not null default 0,
  max_credits integer not null default 0,
  stage text not null,
  primary key (player_id, module_id)
);

-- certification levels reached
create table public.temolima_learning_levels (
  player_id uuid not null references public.temolima_players (id) on delete cascade,
  level_id text not null,
  n integer not null,
  name text not null,
  reached_on date,
  claimed boolean not null default false,
  primary key (player_id, level_id)
);

-- Farm basics lessons read, climate-smart practices played, farmer courses booked
create table public.temolima_learning_activity (
  player_id uuid not null references public.temolima_players (id) on delete cascade,
  kind text not null check (kind in ('lesson', 'practice', 'course')),
  item_id text not null,
  title text,
  score numeric,
  xp integer,
  on_date date,
  ref text,
  primary key (player_id, kind, item_id)
);

-- partner offers the player saved, with their code for each
create table public.temolima_partner_codes (
  player_id uuid not null references public.temolima_players (id) on delete cascade,
  brand_id text not null,
  brand_name text,
  offer_title text,
  code text not null,
  primary key (player_id, brand_id)
);

-- rewards redeemed with points
create table public.temolima_rewards (
  player_id uuid not null references public.temolima_players (id) on delete cascade,
  reward_id text not null,
  name text,
  percent_off integer,
  primary key (player_id, reward_id)
);

-- saves made before player codes
do $$
begin
  if to_regclass('public.temolima_saves_v1') is not null then
    insert into public.temolima_players (id, farmer_name, stage, days_played, coins, levels_reached, created_at, updated_at, last_seen_at)
    select player_id, farmer_name, coalesce(stage, 0), coalesce(days_played, 0), coalesce(coins, 0), coalesce(levels, 0), created_at, updated_at, updated_at
    from public.temolima_saves_v1
    on conflict (id) do nothing;
    insert into public.temolima_saves (player_id, state, client_saved_at, updated_at)
    select player_id, state, client_saved_at, updated_at from public.temolima_saves_v1
    on conflict (player_id) do nothing;
    drop table public.temolima_saves_v1;
  end if;
end $$;

create index temolima_players_last_seen_idx on public.temolima_players (last_seen_at desc);
create index temolima_partner_codes_code_idx on public.temolima_partner_codes (code);

do $$
declare t text;
begin
  foreach t in array array['temolima_players', 'temolima_saves', 'temolima_achievements', 'temolima_certificates',
    'temolima_learning_modules', 'temolima_learning_levels', 'temolima_learning_activity', 'temolima_partner_codes',
    'temolima_rewards']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Save a player's farm, and file its lists. A save made before the one stored (it arrived late, or came from a phone
-- that was behind) is ignored. p_records is null when the lists have not changed since the last save.
create or replace function public.temolima_save(p_player uuid, p_state jsonb, p_saved_at timestamptz, p_records jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stored timestamptz;
  v_p jsonb;
begin
  if p_player is null then
    raise exception 'invalid player' using errcode = '22023';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid state' using errcode = '22023';
  end if;
  if octet_length(p_state::text) + coalesce(octet_length(p_records::text), 0) > 2000000 then
    raise exception 'save too large' using errcode = '54000';
  end if;
  if p_records is not null and jsonb_typeof(p_records) <> 'object' then
    raise exception 'invalid records' using errcode = '22023';
  end if;
  if p_saved_at is null or p_saved_at > now() + interval '1 day' then
    p_saved_at := now();
  end if;

  insert into public.temolima_players (id) values (p_player) on conflict (id) do nothing;

  select client_saved_at into v_stored from public.temolima_saves where player_id = p_player for update;
  if found and v_stored > p_saved_at then
    return;
  end if;

  insert into public.temolima_saves (player_id, state, client_saved_at)
  values (p_player, p_state, p_saved_at)
  on conflict (player_id) do update set state = excluded.state, client_saved_at = excluded.client_saved_at, updated_at = now();

  if p_records is null then
    update public.temolima_players set last_seen_at = now() where id = p_player;
    return;
  end if;

  v_p := coalesce(p_records -> 'player', '{}'::jsonb);
  update public.temolima_players set
    farmer_name = left(v_p ->> 'farmer_name', 80),
    farmer_look = (v_p ->> 'farmer_look')::integer,
    country = left(v_p ->> 'country', 8),
    coins = coalesce(round((v_p ->> 'coins')::numeric)::bigint, 0),
    points = coalesce(round((v_p ->> 'points')::numeric)::bigint, 0),
    level = coalesce((v_p ->> 'level')::numeric::integer, 0),
    xp = coalesce(round((v_p ->> 'xp')::numeric)::bigint, 0),
    season = coalesce((v_p ->> 'season')::numeric::integer, 0),
    stage = coalesce((v_p ->> 'stage')::numeric::integer, 0),
    days_played = coalesce((v_p ->> 'days_played')::numeric::integer, 0),
    streak = coalesce((v_p ->> 'streak')::numeric::integer, 0),
    best_streak = coalesce((v_p ->> 'best_streak')::numeric::integer, 0),
    learning_credits = coalesce((v_p ->> 'learning_credits')::numeric::integer, 0),
    levels_reached = coalesce((v_p ->> 'levels_reached')::numeric::integer, 0),
    badges_won = coalesce((v_p ->> 'badges_won')::numeric::integer, 0),
    play_seconds = coalesce(round((v_p ->> 'play_seconds')::numeric)::bigint, 0),
    onboarded = coalesce((v_p ->> 'onboarded')::boolean, false),
    updated_at = now(),
    last_seen_at = now()
  where id = p_player;

  delete from public.temolima_achievements where player_id = p_player;
  insert into public.temolima_achievements (player_id, badge_id, game, tier, title, won_on, claimed)
  select distinct on (r.badge_id) p_player, r.badge_id, r.game, r.tier, left(r.title, 200), r.won_on, coalesce(r.claimed, false)
  from jsonb_to_recordset(coalesce(p_records -> 'achievements', '[]')) as r(badge_id text, game text, tier text, title text, won_on date, claimed boolean)
  where r.badge_id is not null;

  delete from public.temolima_certificates where player_id = p_player;
  insert into public.temolima_certificates (player_id, cert_id, kind, title, line, game, issued_on)
  select distinct on (r.cert_id) p_player, r.cert_id, coalesce(r.kind, ''), left(coalesce(r.title, ''), 200), left(r.line, 500), r.game, r.issued_on
  from jsonb_to_recordset(coalesce(p_records -> 'certificates', '[]')) as r(cert_id text, kind text, title text, line text, game text, issued_on date)
  where r.cert_id is not null;

  delete from public.temolima_learning_modules where player_id = p_player;
  insert into public.temolima_learning_modules (player_id, module_id, name, credits, max_credits, stage)
  select distinct on (r.module_id) p_player, r.module_id, coalesce(r.name, r.module_id), coalesce(r.credits, 0), coalesce(r.max_credits, 0), coalesce(r.stage, 'new')
  from jsonb_to_recordset(coalesce(p_records -> 'modules', '[]')) as r(module_id text, name text, credits integer, max_credits integer, stage text)
  where r.module_id is not null;

  delete from public.temolima_learning_levels where player_id = p_player;
  insert into public.temolima_learning_levels (player_id, level_id, n, name, reached_on, claimed)
  select distinct on (r.level_id) p_player, r.level_id, coalesce(r.n, 0), coalesce(r.name, r.level_id), r.reached_on, coalesce(r.claimed, false)
  from jsonb_to_recordset(coalesce(p_records -> 'levels', '[]')) as r(level_id text, n integer, name text, reached_on date, claimed boolean)
  where r.level_id is not null;

  delete from public.temolima_learning_activity where player_id = p_player;
  insert into public.temolima_learning_activity (player_id, kind, item_id, title, score, xp, on_date, ref)
  select distinct on (r.kind, r.item_id) p_player, r.kind, r.item_id, left(r.title, 200), r.score, r.xp, r.on_date, left(r.ref, 80)
  from jsonb_to_recordset(coalesce(p_records -> 'learning', '[]')) as r(kind text, item_id text, title text, score numeric, xp integer, on_date date, ref text)
  where r.item_id is not null and r.kind in ('lesson', 'practice', 'course');

  delete from public.temolima_partner_codes where player_id = p_player;
  insert into public.temolima_partner_codes (player_id, brand_id, brand_name, offer_title, code)
  select distinct on (r.brand_id) p_player, r.brand_id, r.brand_name, left(r.offer_title, 200), left(r.code, 40)
  from jsonb_to_recordset(coalesce(p_records -> 'partnerCodes', '[]')) as r(brand_id text, brand_name text, offer_title text, code text)
  where r.brand_id is not null and r.code is not null;

  delete from public.temolima_rewards where player_id = p_player;
  insert into public.temolima_rewards (player_id, reward_id, name, percent_off)
  select distinct on (r.reward_id) p_player, r.reward_id, r.name, r.percent_off
  from jsonb_to_recordset(coalesce(p_records -> 'rewards', '[]')) as r(reward_id text, name text, percent_off integer)
  where r.reward_id is not null;
end;
$$;

-- The farm saved under a player code, to open it on another phone (null when there is none).
create or replace function public.temolima_restore(p_player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('state', s.state, 'saved_at', s.client_saved_at, 'farmer_name', p.farmer_name)
  from public.temolima_saves s
  join public.temolima_players p on p.id = s.player_id
  where s.player_id = p_player;
$$;

revoke all on function public.temolima_save(uuid, jsonb, timestamptz, jsonb) from public;
revoke all on function public.temolima_restore(uuid) from public;
grant execute on function public.temolima_save(uuid, jsonb, timestamptz, jsonb) to anon, authenticated;
grant execute on function public.temolima_restore(uuid) to anon, authenticated;
