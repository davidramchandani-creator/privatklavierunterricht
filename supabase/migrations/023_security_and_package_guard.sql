-- Migration 023: Sicherheits-Hardening (Supabase Advisors) + Schutz gegen
-- doppelten Paketkauf. (Am 2026-08-03 direkt auf der Live-DB angewendet.)

-- 1) SECURITY DEFINER Views -> SECURITY INVOKER (beide nutzen nur die
--    stillgelegten deutschen Alt-Tabellen und werden vom Code nicht verwendet).
alter view public.v_schueler_mit_paket set (security_invoker = true);
alter view public.v_naechste_termine set (security_invoker = true);

-- 2) search_path für SECURITY DEFINER Funktionen fixieren (Advisor 0011).
alter function public.is_admin() set search_path = public, pg_temp;
alter function public.eigene_schueler_id() set search_path = public, pg_temp;
alter function public.own_profile_id() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.update_aktualisiert_am() set search_path = public, pg_temp;

-- 3) Trigger-/Auth-Funktionen aus der REST-API nehmen.
--    WICHTIG: EXECUTE muss auch von PUBLIC entzogen werden, sonst wirkungslos.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_aktualisiert_am() from public, anon, authenticated;

-- 4) Doppelter Paketkauf: pro Schüler nur EIN aktives Paket
--    (bisher nur check-then-insert im Code -> Race bei Doppelklick).
create unique index if not exists packages_one_active_per_student
  on public.packages (student_id)
  where status = 'active';

-- Hinweis: is_admin(), own_profile_id() und eigene_schueler_id() behalten
-- bewusst EXECUTE für anon/authenticated. Öffentliche SELECT-Policies
-- (z. B. "Aktive Kurse öffentlich lesen") rufen sie auf; ohne EXECUTE bricht
-- die Policy-Auswertung mit "permission denied for function is_admin".
