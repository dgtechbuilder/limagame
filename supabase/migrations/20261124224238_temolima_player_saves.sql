-- TemoLima: each player's game progress, saved from their phone (src/net/cloud.ts).
-- Applied to the Supabase project "MelaPress" (nxjwjklugmwnrlngzrub) on 2026-11-24.
-- Players have no accounts: each device makes a random player id and a secret key. Only a hash of the key is kept,
-- and the table is reachable only through the two functions below, which check the key.
create table public.temolima_saves (
  player_id uuid primary key,
  key_hash bytea not null,
  farmer_name text,
  stage integer,
  days_played integer,
  coins bigint,
  levels integer,
  state jsonb not null,
  client_saved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.temolima_saves is 'TemoLima game progress, one row per player device. Written only via temolima_save().';

alter table public.temolima_saves enable row level security;
revoke all on public.temolima_saves from anon, authenticated;

create index temolima_saves_updated_at_idx on public.temolima_saves (updated_at desc);

-- Save (insert or replace) a player's progress. The first save claims the player id with its key; later saves must
-- carry the same key. A save older than the one stored (sent out of order) is ignored.
create or replace function public.temolima_save(p_player uuid, p_key text, p_state jsonb, p_saved_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash bytea;
  v_stored bytea;
begin
  if p_player is null or p_key is null or length(p_key) < 32 or length(p_key) > 128 then
    raise exception 'invalid player' using errcode = '22023';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid state' using errcode = '22023';
  end if;
  if octet_length(p_state::text) > 2000000 then
    raise exception 'state too large' using errcode = '54000';
  end if;
  if p_saved_at is null or p_saved_at > now() + interval '1 day' then
    p_saved_at := now();
  end if;

  v_hash := sha256(convert_to(p_key, 'UTF8'));

  select key_hash into v_stored from public.temolima_saves where player_id = p_player for update;
  if found and v_stored <> v_hash then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  insert into public.temolima_saves as s
    (player_id, key_hash, farmer_name, stage, days_played, coins, levels, state, client_saved_at)
  values (
    p_player, v_hash,
    left(p_state #>> '{farmer,name}', 80),
    case when jsonb_typeof(p_state -> 'stage') = 'number' then (p_state ->> 'stage')::numeric::integer end,
    case when jsonb_typeof(p_state #> '{ach,days}') = 'number' then (p_state #>> '{ach,days}')::numeric::integer end,
    case when jsonb_typeof(p_state -> 'coins') = 'number' then round((p_state ->> 'coins')::numeric)::bigint end,
    case when jsonb_typeof(p_state #> '{ach,levels}') = 'object' then (select count(*) from jsonb_object_keys(p_state #> '{ach,levels}'))::integer end,
    p_state, p_saved_at
  )
  on conflict (player_id) do update set
    farmer_name = excluded.farmer_name,
    stage = excluded.stage,
    days_played = excluded.days_played,
    coins = excluded.coins,
    levels = excluded.levels,
    state = excluded.state,
    client_saved_at = excluded.client_saved_at,
    updated_at = now()
  where s.client_saved_at <= excluded.client_saved_at;
end;
$$;

-- Read a player's saved progress back (for restoring on a new phone), with the same key.
create or replace function public.temolima_load(p_player uuid, p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.temolima_saves;
begin
  if p_player is null or p_key is null then
    return null;
  end if;
  select * into v_row from public.temolima_saves where player_id = p_player;
  if not found or v_row.key_hash <> sha256(convert_to(p_key, 'UTF8')) then
    return null;
  end if;
  return jsonb_build_object('state', v_row.state, 'saved_at', v_row.client_saved_at);
end;
$$;

revoke all on function public.temolima_save(uuid, text, jsonb, timestamptz) from public;
revoke all on function public.temolima_load(uuid, text) from public;
grant execute on function public.temolima_save(uuid, text, jsonb, timestamptz) to anon, authenticated;
grant execute on function public.temolima_load(uuid, text) to anon, authenticated;
