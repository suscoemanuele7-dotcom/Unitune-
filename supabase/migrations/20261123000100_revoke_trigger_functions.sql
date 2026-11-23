-- Le funzioni dei trigger non devono essere chiamabili via API (/rest/v1/rpc).
-- I trigger continuano a funzionare: il permesso EXECUTE serve solo per
-- chiamarle direttamente, non quando scattano come trigger.
-- (Segnalato dal Security Advisor di Supabase.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_playlist() from public, anon, authenticated;
