-- 033: Rechnungsstatus -> Ratenstatus spiegeln.
-- Angewendet am 2026-08-07.

create or replace function public.sync_instalment_from_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.instalment_id, old.instalment_id);
  if target is null then
    return new;
  end if;

  if new.status = 'paid' then
    update public.package_instalments
       set status = 'paid',
           paid_at = coalesce(new.paid_at, now()),
           invoice_id = new.id
     where id = target;

  elsif new.status = 'pending_confirmation' then
    update public.package_instalments
       set status = 'pending_confirmation',
           paid_at = null,
           invoice_id = new.id
     where id = target;

  elsif new.status in ('unpaid','rejected') then
    update public.package_instalments
       set status = case
                      when due_date < current_date then 'overdue'
                      else 'invoiced'
                    end,
           paid_at = null,
           invoice_id = new.id
     where id = target;
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_sync_instalment on public.invoices;
create trigger invoices_sync_instalment
  after insert or update of status, instalment_id on public.invoices
  for each row execute function public.sync_instalment_from_invoice();

revoke all on function public.sync_instalment_from_invoice() from anon, authenticated;
revoke all on function public.touch_package_instalments() from anon, authenticated;
