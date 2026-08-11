-- ============================================================
-- Testmodus
--
-- Um den Planungsablauf durchzuspielen, ohne dass echte Schüler Post
-- bekommen oder echte Termine entstehen.
--
-- Testschüler sind bewusst **normale** Schüler mit einem Merker, keine
-- Sonderform: nur so testet man den Ablauf, den man später wirklich fährt.
-- Der Merker dient zwei Zwecken — sie restlos wieder entfernen zu können,
-- und eine Runde wahlweise nur auf sie zu beschränken.
--
-- Die zweite Sicherung liegt ausserhalb der Datenbank: EMAIL_REDIRECT_TO
-- leitet jede Mail um, solange gesetzt.
-- ============================================================

alter table profiles
  add column if not exists ist_test boolean not null default false;

comment on column profiles.ist_test is
  'Testschueler. Wird beim Aufraeumen samt allen Daten entfernt.';

create index if not exists profiles_ist_test on profiles (ist_test) where ist_test;

alter table planungsrunden
  add column if not exists nur_test boolean not null default false;

comment on column planungsrunden.nur_test is
  'Probelauf: betrifft ausschliesslich Testschueler.';
