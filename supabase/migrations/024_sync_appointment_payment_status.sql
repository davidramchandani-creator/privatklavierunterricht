-- Migration 024: appointments.payment_status konsistent mit invoices.status halten.
-- Bisher wurde payment_status am Termin nie aktualisiert, wenn der Schüler
-- "Ich habe bezahlt" klickte oder der Admin bestätigte/ablehnte.
-- (Am 2026-08-03 direkt auf der Live-DB angewendet.)

create or replace function public.sync_appointment_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.appointment_id is not null then
    update public.appointments a
    set payment_status = new.status
    where a.id = new.appointment_id
      and a.payment_status is distinct from new.status;
  end if;
  return null;
end;
$$;

revoke execute on function public.sync_appointment_payment_status() from public, anon, authenticated;

drop trigger if exists invoices_sync_appointment_payment_status on public.invoices;
create trigger invoices_sync_appointment_payment_status
after insert or update of status on public.invoices
for each row execute function public.sync_appointment_payment_status();

-- Backfill
update public.appointments a
set payment_status = i.status
from public.invoices i
where i.appointment_id = a.id
  and a.payment_status is distinct from i.status;
