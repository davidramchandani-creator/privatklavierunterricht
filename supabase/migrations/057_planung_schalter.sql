-- ============================================================
-- Zwei Schalter pro Schüler: Zuteilung und Hausbesuch
--
-- Bisher gab es nur `aktiv`, und das war zu grob. Wer aus der Planung
-- heraussollte, musste stillgelegt werden — und verschwand damit auch aus
-- Kalender, Zahlungen und Abrechnung. Für „diesen Halbjahresplan lasse ich
-- ihn aussen vor, unterrichtet wird er weiter" gab es nichts.
--
-- ── planung_aktiv ───────────────────────────────────────────
--
-- Nimmt der Schüler an der Zuteilung teil? Bei `false` sucht ihm weder die
-- Zuteilung noch der Routenplaner einen Platz, und er wird nicht mehr
-- gemahnt, seine Zeiten anzugeben.
--
-- **Sein bestehender fester Termin blockiert trotzdem weiter.** Das ist
-- kein Versehen, sondern der Kern: Wer aus der Planung fällt, hört nicht
-- auf zu existieren. Liesse man seinen Platz frei erscheinen, würde dort
-- jemand anders eingeplant und David hätte zwei Schüler zur selben Zeit.
--
-- ── hausbesuch ──────────────────────────────────────────────
--
-- Fährt David hin? Bei `false` kommt der Schüler zu ihm (oder es läuft
-- online). Die Lektion belegt weiterhin ihre Zeit, kostet aber keine
-- Fahrt — in der Routenrechnung sitzt der Schüler dann an Davids eigener
-- Adresse statt an seiner.
--
-- Ihn stattdessen ganz aus der Route zu nehmen wäre der naheliegende, aber
-- falsche Weg: Die Zeit wäre dann scheinbar frei, und der Planer würde
-- jemanden quer durch den Kanton auf diesen Termin legen.
-- ============================================================

alter table profiles
  add column if not exists planung_aktiv boolean not null default true;

alter table profiles
  add column if not exists hausbesuch boolean not null default true;

comment on column profiles.planung_aktiv is
  'Nimmt an Zuteilung und Routenplanung als Kandidat teil. Bestehende feste Termine blockieren unabhängig davon weiter.';

comment on column profiles.hausbesuch is
  'David fährt zum Schüler. Bei false findet die Lektion bei ihm statt: belegt Zeit, kostet keine Fahrt.';

-- Beide Filter laufen zusammen mit role/aktiv/ist_test, darum ein
-- gemeinsamer Index statt zwei einzelner.
create index if not exists profiles_planung_kandidaten
  on profiles (role, aktiv, ist_test, planung_aktiv);
