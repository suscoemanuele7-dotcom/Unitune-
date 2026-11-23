-- Test di integrazione: schema + RLS. Fallisce con un'eccezione al primo errore.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'anna@uni.it'),
  ('22222222-2222-2222-2222-222222222222', 'marco@uni.it');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, false);
$$;
create function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'TEST FALLITO: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

select pg_temp.check((select display_name from profiles where id = '11111111-1111-1111-1111-111111111111') = 'anna',
  'il trigger crea il profilo dal prefisso email');

-- ── Anna crea dati ──
set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
insert into playlists (id, name, is_public) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Studio', false);
insert into playlists (id, name, is_public, is_university) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Festa di facoltà', true, true);
insert into playlist_tracks (playlist_id, track_id, title, position) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'dQw4w9WgXcQ', 'Brano 1', 0),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'fJ9rUzIMcZQ', 'Brano 2', 0);
insert into favorites (track_id, title) values ('dQw4w9WgXcQ', 'Brano 1');
insert into history (track_id, title) values ('dQw4w9WgXcQ', 'Brano 1');
select pg_temp.check((select count(*) from playlist_summaries) = 2, 'anna vede le sue 2 playlist');
select pg_temp.check((select track_count from playlist_summaries where name = 'Studio') = 1, 'la vista conta i brani');
select pg_temp.check((select cover_urls from playlist_summaries where name = 'Studio') = '{""}', 'la vista restituisce le cover');

do $$ begin
  insert into playlists (name, is_university, is_public) values ('x', true, false);
  raise exception 'TEST FALLITO: playlist università privata accettata';
exception when check_violation then raise notice 'ok - università deve essere pubblica';
end $$;
do $$ begin
  insert into favorites (track_id, title) values ('non-valido', 'x');
  raise exception 'TEST FALLITO: track_id non valido accettato';
exception when check_violation then raise notice 'ok - track_id validato';
end $$;
insert into favorites (source, track_id, title) values ('audius', 'V66vyPP', 'Brano Audius');
select pg_temp.check((select count(*) from favorites) = 2, 'preferiti da fonti diverse (youtube + audius)');
do $$ begin
  insert into favorites (source, track_id, title) values ('audius', 'id-con-trattini', 'x');
  raise exception 'TEST FALLITO: id Audius non valido accettato';
exception when check_violation then raise notice 'ok - id Audius validato';
end $$;
do $$ begin
  insert into history (source, track_id, title) values ('spotify', 'abc', 'x');
  raise exception 'TEST FALLITO: fonte sconosciuta accettata';
exception when check_violation then raise notice 'ok - fonte sconosciuta rifiutata';
end $$;
do $$ begin
  insert into favorites (source, track_id, title) values ('audius', 'V66vyPP', 'doppione');
  raise exception 'TEST FALLITO: preferito duplicato accettato';
exception when unique_violation then raise notice 'ok - niente preferiti duplicati';
end $$;

-- ── Marco: vede solo ciò che è pubblico ──
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from playlists) = 1, 'marco vede solo la playlist pubblica di anna');
select pg_temp.check((select count(*) from playlist_tracks) = 1, 'marco vede solo i brani della playlist pubblica');
select pg_temp.check((select owner_name from playlist_summaries) = 'anna', 'marco vede il nome del proprietario');
select pg_temp.check((select count(*) from favorites) = 0, 'marco non vede i preferiti di anna');
select pg_temp.check((select count(*) from history) = 0, 'marco non vede la cronologia di anna');

update playlists set name = 'hackerata' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
delete from playlist_tracks;
select pg_temp.check((select name from playlists where id = 'aaaaaaaa-0000-0000-0000-000000000002') = 'Festa di facoltà',
  'marco non può modificare la playlist di anna');
select pg_temp.check((select count(*) from playlist_tracks) = 1, 'marco non può cancellare brani altrui');

do $$ begin
  insert into playlist_tracks (playlist_id, track_id, title, position)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'hTWKbfoikeg', 'intruso', 1);
  raise exception 'TEST FALLITO: marco ha aggiunto brani a una playlist altrui';
exception when insufficient_privilege then raise notice 'ok - niente inserimenti in playlist altrui';
end $$;
do $$ begin
  insert into favorites (user_id, track_id, title) values ('11111111-1111-1111-1111-111111111111', 'hTWKbfoikeg', 'x');
  raise exception 'TEST FALLITO: marco ha scritto nei preferiti di anna';
exception when insufficient_privilege then raise notice 'ok - niente scritture per conto di altri';
end $$;

insert into playlist_saves (playlist_id) values ('aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from playlist_saves) = 1, 'marco salva la playlist pubblica');
do $$ begin
  insert into playlist_saves (playlist_id) values ('aaaaaaaa-0000-0000-0000-000000000001');
  raise exception 'TEST FALLITO: salvata una playlist privata';
exception when insufficient_privilege then raise notice 'ok - le playlist private non si salvano';
end $$;

do $$ begin
  perform 1 from yt_cache;
  raise exception 'TEST FALLITO: authenticated legge yt_cache';
exception when insufficient_privilege then raise notice 'ok - yt_cache inaccessibile al client';
end $$;
do $$ begin
  perform consume_search_quota('22222222-2222-2222-2222-222222222222', 5);
  raise exception 'TEST FALLITO: authenticated chiama consume_search_quota';
exception when insufficient_privilege then raise notice 'ok - quota RPC riservata alla service_role';
end $$;

-- ── anon: nessun accesso ──
reset role; set role anon;
do $$ begin
  perform 1 from playlists;
  raise exception 'TEST FALLITO: anon legge playlists';
exception when insufficient_privilege then raise notice 'ok - anon non legge nulla';
end $$;

-- ── service_role: quota giornaliera ──
reset role; set role service_role;
select pg_temp.check(consume_search_quota('22222222-2222-2222-2222-222222222222', 2), 'quota: 1a ricerca ok');
select pg_temp.check(consume_search_quota('22222222-2222-2222-2222-222222222222', 2), 'quota: 2a ricerca ok');
select pg_temp.check(not consume_search_quota('22222222-2222-2222-2222-222222222222', 2), 'quota: 3a ricerca bloccata');
insert into yt_cache values ('k1', '{}', now() - interval '1 hour'), ('k2', '{}', now() + interval '1 hour');
select pg_temp.check(purge_expired_yt_cache() = 1, 'purge rimuove solo le voci scadute');

-- ── Eliminazione a cascata (trigger touch compreso) ──
reset role; set role authenticated;
select pg_temp.login('11111111-1111-1111-1111-111111111111');
delete from playlists where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from playlists) = 1, 'anna elimina la sua playlist (con brani)');
reset role;
select pg_temp.check((select count(*) from playlist_saves) = 0, 'i salvataggi spariscono con la playlist');
