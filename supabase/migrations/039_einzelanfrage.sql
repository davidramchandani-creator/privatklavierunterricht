-- ============================================================
-- Einzelne Zeitabfrage
--
-- Bisher liess sich nur die ganze Schar auf einmal fragen. Wer zwischen zwei
-- Runden abschliesst, hätte bis zur nächsten Runde warten müssen – während er
-- schon zahlt.
--
-- Statt einen zweiten Mechanismus danebenzustellen, ist eine Einzelanfrage
-- schlicht eine Runde für eine Person. Dieselbe Tabelle, dasselbe Formular im
-- Portal, dieselbe Zuteilungsrechnung. Nur der Adressatenkreis ist kleiner.
-- ============================================================

alter table planungsrunden
  add column if not exists nur_student_id uuid
    references profiles(id) on delete cascade;

comment on column planungsrunden.nur_student_id is
  'Gesetzt = Einzelanfrage an genau diesen Schüler. NULL = Runde für alle.';

-- Nur eine offene Einzelanfrage pro Schüler: sonst bekäme jemand bei jedem
-- Klick eine weitere Mail zur selben Sache.
create unique index if not exists planungsrunden_offene_einzelanfrage
  on planungsrunden (nur_student_id)
  where status = 'offen' and nur_student_id is not null;

-- Die allgemeinen Runden bleiben wie gehabt: höchstens eine offen.
create index if not exists planungsrunden_offen_allgemein
  on planungsrunden (status)
  where nur_student_id is null;
