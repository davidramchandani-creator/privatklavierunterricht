-- ============================================================
-- Gerade oder ungerade Kalenderwoche, pro Schüler
--
-- Zweiwöchentliche Schüler belegen eine Position jede zweite Woche. Welche
-- der beiden Wochen das ist, hat der Planer bisher nie entschieden, sondern
-- immer „gerade" genommen. Bei drei zweiwöchentlichen Schülern stand
-- dadurch die gesamte ungerade Woche leer, obwohl dieselben Plätze frei
-- gewesen wären — und ändern liess es sich nirgends.
--
-- Der Wert ist absichtlich optional. `null` heisst „egal, teil mich zu, wie
-- es am besten passt"; der Planer verteilt diese Schüler dann abwechselnd,
-- damit beide Wochen gleich voll werden. Wer einen Wert gesetzt hat, wird
-- respektiert — daran hängt der Tauschknopf im Plan.
--
-- Kein Wert für wöchentliche Schüler: Sie haben jede Woche Unterricht, die
-- Frage stellt sich nicht. Die Spalte bleibt dort einfach leer.
-- ============================================================

alter table public.profiles
  add column if not exists kw_praeferenz text
    check (kw_praeferenz in ('gerade', 'ungerade'));

comment on column public.profiles.kw_praeferenz is
  'Bevorzugte Kalenderwoche bei zweiwoechentlichem Unterricht. NULL = egal, der Planer gleicht aus.';
