-- Migration 028: Scheduler alle 5 Minuten via pg_cron.
--
-- Vercel Hobby erlaubt nur einen Cron-Lauf pro Tag – zu selten für
-- Terminerinnerungen. pg_cron ruft den Endpoint deshalb selbst alle 5 Minuten
-- auf. Behebt gleichzeitig die verzögerten Zahlungsmails.
--
-- Voraussetzung: Vault-Secret "cron_secret" mit demselben Wert wie die
-- Vercel-Umgebungsvariable CRON_SECRET.
--   select vault.create_secret('<token>', 'cron_secret', 'Bearer-Token fuer Cron');
--
-- Job anlegen (einmalig, nicht Teil dieser Migration, da cron.schedule
-- nicht idempotent ist):
--   select cron.schedule('notification-dispatch', '*/5 * * * *',
--                        $$select public.trigger_notification_cron();$$);

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_notification_cron()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
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

  perform extensions.http_post(
    url     := 'https://privatklavierunterricht.vercel.app/api/cron/send-emails',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || secret
               ),
    timeout_milliseconds := 25000
  );
end;
$$;

revoke execute on function public.trigger_notification_cron() from public, anon, authenticated;
