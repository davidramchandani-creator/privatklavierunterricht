-- ============================================================
-- Neue Schüler kommen ins Studio
--
-- David, 1. November 2026: Keine Hausbesuche mehr für neue Schüler. Der
-- Unterricht findet im Studio in Neftenbach statt. Bestehende Schüler
-- behalten ihre Einstellung, David entscheidet im Admin selbst, bei wem er
-- weiterhin hinfährt.
--
-- Darum ändert sich nur die Vorgabe für neue Profile, kein bestehender
-- Eintrag.
-- ============================================================

alter table profiles alter column hausbesuch set default false;

comment on column profiles.hausbesuch is
  'David fährt zum Schüler. Vorgabe seit November 2026: false, der Unterricht findet im Studio in Neftenbach statt.';
