-- ════════════════════════════════════════════════════════════════════════
-- Permessi espliciti sulle tabelle.
--
-- I progetti Supabase recenti non espongono più automaticamente le nuove
-- tabelle ai ruoli dell'API (anon / authenticated / service_role): senza
-- GRANT ogni richiesta riceve "permission denied" (42501).
-- Concediamo solo ciò che serve; le policy RLS restano il secondo livello
-- di protezione (quali righe), i GRANT il primo (quali operazioni).
-- ════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated, service_role;

-- Utenti loggati
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.playlists to authenticated;
grant select, insert, update, delete on public.playlist_tracks to authenticated;
grant select, insert, delete on public.playlist_saves to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;
grant select, insert, delete on public.history to authenticated;
grant select on public.playlist_summaries to authenticated;

-- Funzione usata nei vincoli CHECK (deve essere eseguibile da chi scrive).
grant execute on function public.is_valid_track(text, text) to authenticated, service_role;

-- Edge Function (service_role): cache e contatori delle ricerche.
grant select, insert, update, delete on public.yt_cache to service_role;
grant select, insert, update, delete on public.api_usage to service_role;
-- service_role: accesso completo per attività amministrative.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Il ruolo anon (utente non loggato) continua a non accedere a nulla.
