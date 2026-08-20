-- ============================================================
-- Wo der Unterrichtsabend beginnt
-- Angewendet am 2026-08-20.
--
-- Der Routenplaner nahm bisher an, jeder Abend starte zuhause in
-- Neftenbach. An Tagen mit Hochschule stimmt das nicht: David kommt dann
-- von der Lagerstrasse in Zürich und fährt mit dem Zug.
--
-- Der Unterschied ist nicht kosmetisch. Von zuhause aus ist ein Schüler in
-- Neftenbach der naheliegende erste Halt und einer in Winterthur ein Umweg.
-- Von Zürich HB aus ist es genau umgekehrt. Ohne diese Angabe ordnet der
-- Planer den ganzen Abend falsch — und zwar plausibel aussehend, was es
-- schlimmer macht.
--
-- Der Heimweg bleibt der Heimweg: Am Ende fährt er nach Hause, nicht
-- zurück zur Hochschule.
--
-- Leer heisst „von zuhause". Damit ändert sich für alle bestehenden Tage
-- nichts.
-- ============================================================

alter table public.admin_verfuegbarkeit
  add column if not exists start_adresse text,
  add column if not exists start_lat double precision,
  add column if not exists start_lng double precision;

comment on column public.admin_verfuegbarkeit.start_adresse is
  'Von wo der Abend startet, z. B. die Hochschule. Leer = von zuhause.';

-- Halbe Angaben wären schlimmer als gar keine: Mit Adresse, aber ohne
-- Koordinaten könnte der Planer nichts rechnen und fiele stillschweigend
-- auf zuhause zurück — obwohl in der Oberfläche eine Adresse steht.
do $$ begin
  alter table public.admin_verfuegbarkeit
    add constraint admin_verfuegbarkeit_start_vollstaendig
    check (
      (start_adresse is null and start_lat is null and start_lng is null)
      or (start_adresse is not null and start_lat is not null and start_lng is not null)
    );
exception when duplicate_object then null; end $$;
