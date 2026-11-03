-- ============================================================
-- Neue Preise auf den SMPV-Richtwert gesetzt
--
-- David, 3. November 2026: Das Semesterabo soll genau dem Richtwert des
-- SMPV entsprechen (CHF 110 pro 60 Minuten für Erwachsene, auf 45 Minuten
-- 82.50). Einzellektion und Jahresabo mit demselben Abstand wie vorher.
--
--   Einzellektion 97.50, Semesterabo 82.50, Jahresabo 77.50
--
-- Gilt nur für neu angelegte Profile. Muss mit src/lib/neupreise.ts
-- übereinstimmen.
-- ============================================================

alter table public.profiles
  alter column price_single set default 97.50,
  alter column price_halbjahr set default 82.50,
  alter column price_jahr set default 77.50;

update public.preise set preis_pro_lektion = 97.50 where typ = 'einzellektion';
update public.preise set preis_pro_lektion = 82.50 where typ = 'halbjahr';
update public.preise set preis_pro_lektion = 77.50 where typ = 'jahr';
