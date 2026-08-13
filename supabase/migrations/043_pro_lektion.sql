-- ============================================================
-- Abrechnung pro Lektion
--
-- Bisher gab es zwei Arten, ein Paket zu bezahlen:
--
--   einmalig  Der Gesamtbetrag wird beim Anlegen sofort in Rechnung
--             gestellt.
--   raten     Monatsraten über die Laufzeit.
--
-- Beide verlangen, dass der Schüler zahlt, bevor er die Lektionen hatte.
-- Genau das trifft auf die bestehenden Schüler nicht zu: Sie zahlen nach
-- der Lektion. Für sie gab es bisher keine passende Einstellung, und wer
-- ihnen ein Paket anlegte, verschickte ungewollt eine Rechnung über den
-- vollen Betrag.
--
--   pro_lektion  Beim Anlegen wird nichts fakturiert. Jede gehaltene
--                Lektion wird einzeln abgerechnet.
-- ============================================================

alter table packages drop constraint if exists packages_billing_mode_check;

alter table packages add constraint packages_billing_mode_check
  check (billing_mode in ('einmalig', 'raten', 'pro_lektion'));

comment on column packages.billing_mode is
  'einmalig = Gesamtbetrag beim Anlegen, raten = Monatsraten, pro_lektion = nach jeder Lektion einzeln';
