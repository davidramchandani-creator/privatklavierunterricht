-- ============================================================
-- Neue Preise eine Stufe tiefer
--
-- David, 4. November 2026: Einzellektion 95, Semesterabo 80, Jahresabo 75
-- (vorher 97.50 / 82.50 / 77.50). Gilt nur für neu angelegte Profile.
-- Muss mit src/lib/neupreise.ts übereinstimmen.
-- ============================================================

alter table public.profiles
  alter column price_single set default 95.00,
  alter column price_halbjahr set default 80.00,
  alter column price_jahr set default 75.00;

update public.preise set preis_pro_lektion = 95.00 where typ = 'einzellektion';
update public.preise set preis_pro_lektion = 80.00 where typ = 'halbjahr';
update public.preise set preis_pro_lektion = 75.00 where typ = 'jahr';
