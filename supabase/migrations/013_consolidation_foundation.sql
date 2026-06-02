-- Migration 013: Konsolidierungs-Fundament
-- Ziel: EIN Datenmodell. `profiles` ist die einzige Wahrheitsquelle für Schüler
-- (inkl. Rolle und Zahlungsart). Die deutschen Alt-Tabellen werden in einem
-- späteren Schritt stillgelegt, sobald kein Code mehr darauf zugreift.

-- 1) Zahlungsart pro Schüler (TWINT oder QR-Rechnung) – Spec §6, §11.2
alter table public.profiles
  add column if not exists payment_method text
    check (payment_method in ('twint', 'qr')) default 'qr';

-- 2) Auth-Trigger: bei neuem Auth-User direkt eine `profiles`-Zeile anlegen
--    (Rolle 'student'). profile_roles wird übergangsweise weiter befüllt,
--    bis es im nächsten Schritt entfernt wird.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, role, email, vorname, nachname)
  values (
    new.id,
    'student',
    new.email,
    coalesce(new.raw_user_meta_data->>'vorname', ''),
    coalesce(new.raw_user_meta_data->>'nachname', '')
  )
  on conflict (id) do nothing;

  insert into public.profile_roles (user_id, role)
  values (new.id, 'schueler')
  on conflict (user_id) do nothing;

  return new;
end;
$$;
