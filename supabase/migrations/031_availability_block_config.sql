-- Migration 031: Lektionsdauer und Mindestpuffer pro Verfügbarkeitsblock.
-- (Am 2026-08-03 direkt auf der Live-DB angewendet.)
--
-- Bisher waren 45 Minuten fest im Code und der Puffer hing am Schüler.
-- Neu gehört beides zum Block: Die Lektionsdauer bestimmt das Raster, der
-- Mindestpuffer ist die Untergrenze. Der tatsächliche Puffer eines Übergangs
-- ist das Maximum aus Mindestpuffer und den Fahrzeiten beider Schüler.

alter table public.admin_verfuegbarkeit
  add column if not exists lesson_minutes smallint not null default 45
    check (lesson_minutes between 15 and 180),
  add column if not exists min_buffer_minutes smallint not null default 15
    check (min_buffer_minutes between 0 and 120),
  add column if not exists packing text not null default 'lueckenlos'
    check (packing in ('lueckenlos', 'maximal'));

comment on column public.admin_verfuegbarkeit.lesson_minutes is
  'Dauer einer Lektion in diesem Block (Standard 45).';
comment on column public.admin_verfuegbarkeit.min_buffer_minutes is
  'Untergrenze für den Puffer zwischen zwei Lektionen (Standard 15).';
comment on column public.admin_verfuegbarkeit.packing is
  'lueckenlos = Lektionen bündig aneinander; maximal = mehr Auswahl, kleine Löcher erlaubt.';
