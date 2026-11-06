-- ============================================================
-- RLS-Test: Was sieht eine Lehrperson, was sieht ein Besucher?
--
-- Ausführen im Supabase-SQL-Editor (oder über das MCP-Werkzeug). Alles
-- läuft in einer Transaktion und wird am Ende zurückgerollt, es bleibt
-- nichts in der Datenbank.
--
-- Erwartet (Stand Schritt 1a, 6.11.2026):
--   lehrperson:* = 0 für Termine, Abos, Rechnungen, Raten, Notizen,
--                  Warteliste, Verfügbarkeit, Zeitblöcke, Audit-Log
--   lehrperson:profiles = 1 (nur das eigene), lehrperson:teachers = 1
--   lehrperson:is_admin = 0, lehrperson:is_lehrperson = 1
--   anon:* = 0
-- Ab Schritt 1e kommen hier die eigenen Termine und Schüler dazu, die die
-- Lehrperson dann sehen darf, und Lehrperson B, die nichts von A sieht.
-- ============================================================

begin;
create temp table rls_ergebnis (fall text, anzahl bigint, erwartet bigint);
grant all on rls_ergebnis to public;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('00000000-0000-4000-8000-0000000000a1', 'rls-test-lehrperson@example.invalid',
        '{"vorname":"Test","nachname":"Lehrperson"}', 'authenticated', 'authenticated');
update public.profile_roles set role = 'lehrperson' where user_id = '00000000-0000-4000-8000-0000000000a1';
update public.profiles set role = 'lehrperson', teacher_id = null where id = '00000000-0000-4000-8000-0000000000a1';
insert into public.teachers (profile_id, vorname, nachname, status)
values ('00000000-0000-4000-8000-0000000000a1', 'Test', 'Lehrperson', 'aktiv');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
insert into rls_ergebnis select 'lehrperson:appointments', count(*), 0 from appointments;
insert into rls_ergebnis select 'lehrperson:packages', count(*), 0 from packages;
insert into rls_ergebnis select 'lehrperson:invoices', count(*), 0 from invoices;
insert into rls_ergebnis select 'lehrperson:package_instalments', count(*), 0 from package_instalments;
insert into rls_ergebnis select 'lehrperson:profiles', count(*), 1 from profiles;
insert into rls_ergebnis select 'lehrperson:admin_verfuegbarkeit', count(*), 0 from admin_verfuegbarkeit;
insert into rls_ergebnis select 'lehrperson:time_blocks', count(*), 0 from time_blocks;
insert into rls_ergebnis select 'lehrperson:teachers', count(*), 1 from teachers;
insert into rls_ergebnis select 'lehrperson:audit_log', count(*), 0 from audit_log;
insert into rls_ergebnis select 'lehrperson:lektionsnotizen', count(*), 0 from lektionsnotizen;
insert into rls_ergebnis select 'lehrperson:warteliste', count(*), 0 from warteliste;
insert into rls_ergebnis select 'lehrperson:is_admin', is_admin()::int, 0;
insert into rls_ergebnis select 'lehrperson:is_lehrperson', is_lehrperson()::int, 1;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
insert into rls_ergebnis select 'anon:admin_verfuegbarkeit', count(*), 0 from admin_verfuegbarkeit;
insert into rls_ergebnis select 'anon:time_blocks', count(*), 0 from time_blocks;
insert into rls_ergebnis select 'anon:time_block_rules', count(*), 0 from time_block_rules;
insert into rls_ergebnis select 'anon:teachers', count(*), 0 from teachers;
insert into rls_ergebnis select 'anon:profiles', count(*), 0 from profiles;
reset role;

select fall, anzahl, erwartet, case when anzahl = erwartet then 'ok' else 'FEHLER' end as ergebnis
from rls_ergebnis;
rollback;

-- ============================================================
-- Schritt 1b: Leitbild und Profiltext, zwei Lehrpersonen A und B
-- Erwartet: alle Zeilen „ok“.
-- ============================================================
begin;
create temp table rls_ergebnis (fall text, anzahl bigint, erwartet bigint);
grant all on rls_ergebnis to public;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-4000-8000-0000000000a1', 'a@example.invalid', '{"vorname":"A","nachname":"Test"}', 'authenticated', 'authenticated'),
 ('00000000-0000-4000-8000-0000000000b2', 'b@example.invalid', '{"vorname":"B","nachname":"Test"}', 'authenticated', 'authenticated');
update public.profile_roles set role='lehrperson' where user_id in ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000b2');
update public.profiles set role='lehrperson', teacher_id=null where id in ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000b2');
insert into public.teachers (id, profile_id, vorname, nachname) values
 ('00000000-0000-4000-8000-00000000aaaa','00000000-0000-4000-8000-0000000000a1','A','Test'),
 ('00000000-0000-4000-8000-00000000bbbb','00000000-0000-4000-8000-0000000000b2','B','Test');
insert into public.leitbild_versionen (id, version, inhalt) values ('00000000-0000-4000-8000-00000000cccc', 999, 'Test-Leitbild mit genug Text');
insert into public.leitbild_bestaetigungen (version_id, teacher_id) values ('00000000-0000-4000-8000-00000000cccc','00000000-0000-4000-8000-00000000bbbb');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
insert into rls_ergebnis select 'A liest Leitbild', count(*), 1 from leitbild_versionen where version=999;
insert into rls_ergebnis select 'A sieht Bestätigung von B nicht', count(*), 0 from leitbild_bestaetigungen;
insert into rls_ergebnis select 'A sieht B nicht', count(*), 1 from teachers;
insert into public.leitbild_bestaetigungen (version_id, teacher_id) values ('00000000-0000-4000-8000-00000000cccc','00000000-0000-4000-8000-00000000aaaa');
insert into rls_ergebnis select 'A bestätigt für sich', count(*), 1 from leitbild_bestaetigungen;
do $$ begin
  begin
    insert into public.leitbild_bestaetigungen (version_id, teacher_id) values ('00000000-0000-4000-8000-00000000cccc','00000000-0000-4000-8000-00000000bbbb');
    insert into rls_ergebnis values ('A bestätigt für B (verboten)', 1, 0);
  exception when others then
    insert into rls_ergebnis values ('A bestätigt für B (verboten)', 0, 0);
  end;
  begin
    update public.teachers set kurztext = 'gehackt' where profile_id = '00000000-0000-4000-8000-0000000000a1';
    insert into rls_ergebnis select 'A ändert eigenen Text direkt (verboten)', count(*), 0 from teachers where kurztext='gehackt';
  exception when others then
    insert into rls_ergebnis values ('A ändert eigenen Text direkt (verboten)', 0, 0);
  end;
  begin
    insert into public.leitbild_versionen (version, inhalt) values (1000, 'gefälschtes Leitbild');
    insert into rls_ergebnis values ('A schreibt Leitbild (verboten)', 1, 0);
  exception when others then
    insert into rls_ergebnis values ('A schreibt Leitbild (verboten)', 0, 0);
  end;
end $$;
reset role;
select fall, anzahl, erwartet, case when anzahl=erwartet then 'ok' else 'FEHLER' end as ergebnis from rls_ergebnis;
rollback;
