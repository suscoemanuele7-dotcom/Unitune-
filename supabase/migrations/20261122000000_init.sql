-- ════════════════════════════════════════════════════════════════════════
-- UniTune — schema iniziale
--
-- Tabelle utente: profiles, playlists, playlist_tracks, playlist_saves,
--                 favorites, history
-- Tabelle di servizio (solo Edge Function): yt_cache, api_usage
--
-- Tutte le tabelle hanno Row Level Security attiva: con la anon key il
-- client vede/modifica solo ciò che le policy consentono.
-- Dei brani salviamo solo metadati pubblici (fonte, id, titolo, artista,
-- thumbnail URL, link, durata): nessun contenuto audio/video.
-- ════════════════════════════════════════════════════════════════════════

-- ── Profili ─────────────────────────────────────────────────────────────
-- Estende auth.users (gestita da Supabase Auth) invece di creare una tabella
-- "users" separata: è il pattern consigliato da Supabase.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at   timestamptz not null default now()
);

-- Crea automaticamente il profilo alla registrazione.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Brani: fonte + ID ───────────────────────────────────────────────────
-- Un brano è identificato da (source, track_id):
--   youtube → ID video di 11 caratteri [A-Za-z0-9_-]
--   audius  → ID traccia alfanumerico (es. "V66vyPP")
create function public.is_valid_track(p_source text, p_track_id text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_source
    when 'youtube' then p_track_id ~ '^[A-Za-z0-9_-]{11}$'
    when 'audius'  then p_track_id ~ '^[A-Za-z0-9]{1,32}$'
    else false
  end
$$;

-- ── Playlist ────────────────────────────────────────────────────────────
create table public.playlists (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 100),
  description   text not null default '' check (char_length(description) <= 300),
  -- Pubblica = visibile (sola lettura) a ogni utente autenticato che ha il link.
  is_public     boolean not null default false,
  -- Mostrata nella sezione "Playlist dell'università" della Home.
  -- Deve essere anche pubblica. (In futuro: riservata a un ruolo "curatore".)
  is_university boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint university_must_be_public check (not is_university or is_public)
);

create index playlists_owner_idx on public.playlists (owner_id, updated_at desc);
create index playlists_university_idx on public.playlists (updated_at desc) where is_university;

create table public.playlist_tracks (
  id             uuid primary key default gen_random_uuid(),
  playlist_id    uuid not null references public.playlists (id) on delete cascade,
  source         text not null default 'youtube',
  track_id       text not null,
  title          text not null,
  channel_title  text not null default '',
  thumbnail_url  text not null default '',
  external_url   text not null default '',
  duration_sec   integer check (duration_sec is null or duration_sec >= 0),
  position       integer not null check (position >= 0),
  added_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  added_at       timestamptz not null default now(),
  constraint playlist_tracks_valid_track check (public.is_valid_track(source, track_id))
);

create index playlist_tracks_order_idx on public.playlist_tracks (playlist_id, position, added_at);

-- Playlist pubbliche di altri utenti salvate nella propria libreria.
create table public.playlist_saves (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  saved_at    timestamptz not null default now(),
  primary key (user_id, playlist_id)
);

-- Aggiorna playlists.updated_at quando cambiano i brani o i metadati.
create function public.touch_playlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'playlists' then
    new.updated_at := now();
    return new;
  end if;
  update public.playlists
     set updated_at = now()
   where id = coalesce(new.playlist_id, old.playlist_id);
  return null;
end;
$$;

create trigger playlists_touch
  before update on public.playlists
  for each row execute function public.touch_playlist();

create trigger playlist_tracks_touch
  after insert or update or delete on public.playlist_tracks
  for each row execute function public.touch_playlist();

-- ── Preferiti ───────────────────────────────────────────────────────────
create table public.favorites (
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  source         text not null default 'youtube',
  track_id       text not null,
  title          text not null,
  channel_title  text not null default '',
  thumbnail_url  text not null default '',
  external_url   text not null default '',
  duration_sec   integer check (duration_sec is null or duration_sec >= 0),
  created_at     timestamptz not null default now(),
  primary key (user_id, source, track_id),
  constraint favorites_valid_track check (public.is_valid_track(source, track_id))
);

create index favorites_recent_idx on public.favorites (user_id, created_at desc);

-- ── Cronologia ──────────────────────────────────────────────────────────
create table public.history (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  source         text not null default 'youtube',
  track_id       text not null,
  title          text not null,
  channel_title  text not null default '',
  thumbnail_url  text not null default '',
  external_url   text not null default '',
  duration_sec   integer check (duration_sec is null or duration_sec >= 0),
  played_at      timestamptz not null default now(),
  constraint history_valid_track check (public.is_valid_track(source, track_id))
);

create index history_recent_idx on public.history (user_id, played_at desc);

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- `(select auth.uid())` invece di `auth.uid()`: valutata una sola volta per
-- query (raccomandazione di performance di Supabase).
-- ════════════════════════════════════════════════════════════════════════
alter table public.profiles        enable row level security;
alter table public.playlists       enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.playlist_saves  enable row level security;
alter table public.favorites       enable row level security;
alter table public.history         enable row level security;

-- profiles: i nomi visualizzati sono visibili agli utenti autenticati
-- (servono per "playlist di <nome>"), ma ognuno modifica solo il proprio.
create policy "profiles: lettura per utenti autenticati"
  on public.profiles for select to authenticated using (true);
create policy "profiles: modifica del proprio profilo"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- playlists
create policy "playlists: lettura proprie o pubbliche"
  on public.playlists for select to authenticated
  using (owner_id = (select auth.uid()) or is_public);
create policy "playlists: creazione"
  on public.playlists for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "playlists: modifica proprie"
  on public.playlists for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "playlists: eliminazione proprie"
  on public.playlists for delete to authenticated
  using (owner_id = (select auth.uid()));

-- playlist_tracks: si leggono se la playlist è leggibile, si modificano
-- solo nelle proprie playlist.
create policy "playlist_tracks: lettura se la playlist è visibile"
  on public.playlist_tracks for select to authenticated
  using (exists (
    select 1 from public.playlists p
     where p.id = playlist_id and (p.owner_id = (select auth.uid()) or p.is_public)
  ));
create policy "playlist_tracks: inserimento nelle proprie playlist"
  on public.playlist_tracks for insert to authenticated
  with check (exists (
    select 1 from public.playlists p
     where p.id = playlist_id and p.owner_id = (select auth.uid())
  ));
create policy "playlist_tracks: modifica nelle proprie playlist"
  on public.playlist_tracks for update to authenticated
  using (exists (
    select 1 from public.playlists p
     where p.id = playlist_id and p.owner_id = (select auth.uid())
  ));
create policy "playlist_tracks: eliminazione nelle proprie playlist"
  on public.playlist_tracks for delete to authenticated
  using (exists (
    select 1 from public.playlists p
     where p.id = playlist_id and p.owner_id = (select auth.uid())
  ));

-- playlist_saves: si possono salvare solo playlist pubbliche di altri.
create policy "playlist_saves: gestione dei propri salvataggi"
  on public.playlist_saves for select to authenticated
  using (user_id = (select auth.uid()));
create policy "playlist_saves: salva playlist pubbliche"
  on public.playlist_saves for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.playlists p where p.id = playlist_id and p.is_public)
  );
create policy "playlist_saves: rimuovi propri salvataggi"
  on public.playlist_saves for delete to authenticated
  using (user_id = (select auth.uid()));

-- favorites e history: strettamente personali.
create policy "favorites: solo i propri"
  on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "history: solo la propria"
  on public.history for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Il ruolo anon (utente non loggato) non accede a nulla.
revoke all on public.profiles, public.playlists, public.playlist_tracks,
              public.playlist_saves, public.favorites, public.history from anon;

-- Vista con il numero di brani e il nome del proprietario: evita N query
-- dal client. `security_invoker` = applica le RLS di chi interroga.
create view public.playlist_summaries
with (security_invoker = true) as
select
  p.id, p.owner_id, p.name, p.description, p.is_public, p.is_university,
  p.created_at, p.updated_at,
  coalesce(pr.display_name, '') as owner_name,
  (select count(*) from public.playlist_tracks t where t.playlist_id = p.id)::integer as track_count,
  -- Fino a 4 thumbnail per la copertina a mosaico.
  coalesce((
    select array_agg(x.thumbnail_url order by x.position, x.added_at)
      from (select t.thumbnail_url, t.position, t.added_at
              from public.playlist_tracks t
             where t.playlist_id = p.id
             order by t.position, t.added_at
             limit 4) x
  ), '{}') as cover_urls
from public.playlists p
left join public.profiles pr on pr.id = p.owner_id;

revoke all on public.playlist_summaries from anon;
grant select on public.playlist_summaries to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Tabelle di servizio della Edge Function `youtube`
-- RLS attiva SENZA policy: accessibili solo con la service_role key, che
-- esiste solo lato server (mai nel client).
-- ════════════════════════════════════════════════════════════════════════

-- Cache delle risposte della YouTube Data API. La Edge Function imposta una
-- scadenza breve (default 24h), ben entro il limite di 30 giorni delle
-- YouTube API Services Developer Policies per i dati non aggiornati.
create table public.yt_cache (
  key        text primary key,
  payload    jsonb not null,
  expires_at timestamptz not null
);
create index yt_cache_expiry_idx on public.yt_cache (expires_at);

-- Contatore giornaliero delle ricerche per utente: un tetto per utente
-- protegge la quota condivisa del progetto (non la aggira).
create table public.api_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  searches integer not null default 0,
  primary key (user_id, day)
);

alter table public.yt_cache  enable row level security;
alter table public.api_usage enable row level security;
revoke all on public.yt_cache, public.api_usage from anon, authenticated;

-- Incrementa in modo atomico il contatore e dice se l'utente può ancora
-- cercare oggi. Chiamabile solo dalla service_role.
create function public.consume_search_quota(p_user uuid, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.api_usage as u (user_id, day, searches)
  values (p_user, (now() at time zone 'America/Los_Angeles')::date, 1)
  on conflict (user_id, day) do update set searches = u.searches + 1
  returning u.searches into v_count;
  return v_count <= p_max;
end;
$$;

revoke execute on function public.consume_search_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_search_quota(uuid, integer) to service_role;

-- Pulizia della cache scaduta (eseguibile da cron/pg_cron o a mano).
create function public.purge_expired_yt_cache()
returns integer
language sql
security definer
set search_path = ''
as $$
  with d as (delete from public.yt_cache where expires_at < now() returning 1)
  select count(*)::integer from d;
$$;

revoke execute on function public.purge_expired_yt_cache() from public, anon, authenticated;
grant execute on function public.purge_expired_yt_cache() to service_role;
