-- ============================================================
-- Ein Profil darf ohne Anmeldekonto existieren
-- Angewendet am 2026-08-20.
--
-- `profiles.id` zeigte per Fremdschlüssel auf `auth.users(id)`. Das war
-- richtig, solange jeder Schüler ein Konto hatte: Die Kennung kam von der
-- Anmeldung, und wurde das Konto gelöscht, verschwand das Profil mit.
--
-- Externe Schüler haben kein Konto. Sie melden sich nie an, bekommen keine
-- Post und sehen kein Portal — es gäbe niemanden, der eine Kennung
-- vergäbe. Der Fremdschlüssel macht sie damit unmöglich.
--
-- ── Was an seine Stelle tritt ───────────────────────────────
--
-- Der Fremdschlüssel leistete zweierlei. Das eine — „jedes Profil gehört
-- zu einem Konto" — gilt nicht mehr und fällt weg. Das andere — „wird ein
-- Konto gelöscht, geht das Profil mit" — bleibt wichtig und wird von einem
-- Trigger übernommen.
--
-- Der Unterschied zum Fremdschlüssel: Der Trigger räumt auf, verbietet
-- aber nichts. Genau das ist gewollt.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_id_fkey;

create or replace function public.profil_zu_konto_loeschen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

comment on function public.profil_zu_konto_loeschen is
  'Ersetzt den weggefallenen Fremdschlüssel profiles.id -> auth.users.id: räumt das Profil weg, wenn das Konto gelöscht wird.';

drop trigger if exists konto_geloescht_profil_weg on auth.users;
create trigger konto_geloescht_profil_weg
  after delete on auth.users
  for each row execute function public.profil_zu_konto_loeschen();
