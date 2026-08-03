-- Migration 029: Zwei Fixes am Cron-Aufruf aus Migration 028.
--
--  1. pg_net legt seine Funktionen im Schema "net" an, nicht in "extensions"
--     -> "function extensions.http_post(...) does not exist"
--  2. Der Endpoint /api/cron/send-emails exportiert nur GET
--     -> http_post lieferte 405 Method Not Allowed
--
-- (Am 2026-08-03 direkt auf der Live-DB angewendet.)

create or replace function public.trigger_notification_cron()
returns void
language plpgsql
security definer
set search_path = public, net, vault, pg_temp
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'cron_secret'
  limit 1;

  if secret is null then
    raise notice 'cron_secret fehlt im Vault – Aufruf uebersprungen';
    return;
  end if;

  perform net.http_get(
    url     := 'https://privatklavierunterricht.vercel.app/api/cron/send-emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 25000
  );
end;
$$;

revoke execute on function public.trigger_notification_cron() from public, anon, authenticated;

-- Diagnose bei Problemen:
--   select status_code, content from net._http_response order by created desc limit 5;
--   401 = Vault-Secret "cron_secret" != Vercel-Variable CRON_SECRET
