-- ============================================================
-- Externe Schüler mitplanen statt ihre Zeit vorgeben
-- Angewendet am 2026-08-20.
--
-- Die erste Fassung verlangte beim Anlegen Wochentag und Uhrzeit: Der
-- Termin sei extern abgemacht, hier werde er nur abgebildet.
--
-- Das trifft den Alltag nicht. Üblich ist umgekehrt: David fragt, wann der
-- Schüler kann, sucht daraus einen Platz, der in seine Route passt, und
-- bestätigt ihn dann über die Plattform. Wer die Zeit vorher wissen muss,
-- kann den Routenplaner dafür gar nicht benutzen — und genau dafür sollten
-- die Externen ja aufgenommen werden.
--
-- Deshalb dürfen Wochentag und Zeit jetzt fehlen. Dann ist die
-- Vereinbarung ein **Planungsauftrag**: Die Verfügbarkeit steht in
-- `student_verfuegbarkeit` (ohne Runde, als Dauerangabe), die Zuteilung
-- sucht den Platz, und beim Anwenden wird er hier eingetragen.
--
-- Beides bleibt möglich. Steht die Zeit fest, blockiert sie wie bisher.
-- ============================================================

alter table public.externe_vereinbarungen
  alter column wochentag drop not null,
  alter column zeit drop not null;

-- Halb gesetzt ergäbe keinen Sinn: ein Wochentag ohne Uhrzeit ist weder
-- ein fester Termin noch ein Planungsauftrag.
do $$ begin
  alter table public.externe_vereinbarungen
    add constraint externe_vereinbarungen_termin_ganz_oder_gar_nicht
    check ((wochentag is null) = (zeit is null));
exception when duplicate_object then null; end $$;

comment on column public.externe_vereinbarungen.wochentag is
  'Fester Termin, oder null: dann sucht die Zuteilung den Platz aus der hinterlegten Verfügbarkeit.';
