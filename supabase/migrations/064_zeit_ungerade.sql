-- ============================================================
-- Jede Woche, aber in ungeraden Wochen zu einer anderen Uhrzeit
--
-- Eine Schülerin kommt jede Woche am selben Tag, in geraden Wochen um die
-- eine, in ungeraden um die andere Zeit. Bisher kannte ein fester Platz nur
-- eine Uhrzeit.
--
-- Die zweite Zeit ist ein Zusatz, kein neues Modell: Ohne sie bleibt alles,
-- wie es war. Mit ihr gilt `fixplatz_time` bzw. `zeit` für gerade Wochen und
-- die neue Spalte für ungerade. Sinnvoll nur bei wöchentlichem Rhythmus;
-- bei zweiwöchentlich gibt es ja nur eine der beiden Wochen.
--
-- Gerade und ungerade nach derselben Wochenzählung wie überall
-- (rhythmus.ts, weekParity).
-- ============================================================

alter table public.packages
  add column if not exists fixplatz_time_ungerade time;

comment on column public.packages.fixplatz_time_ungerade is
  'Abweichende Uhrzeit in ungeraden Wochen bei wöchentlichem Fixplatz. Leer: jede Woche fixplatz_time.';

alter table public.externe_vereinbarungen
  add column if not exists zeit_ungerade time;

comment on column public.externe_vereinbarungen.zeit_ungerade is
  'Abweichende Uhrzeit in ungeraden Wochen bei wöchentlichem Rhythmus. Leer: jede Woche zeit.';
