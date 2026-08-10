-- 036: Abo-Modell — Laufzeit statt Lektionspaket, Schulferien als Grundlage
-- Angewendet am 2026-08-10.
--
-- Umstellung: Der Schüler kauft nicht mehr "10 Lektionen, gültig 4 Monate",
-- sondern "Halbjahr" oder "Jahr" und zahlt monatlich. Wie viele Lektionen
-- darin liegen, ergibt sich aus Rhythmus und Ferienlage — und wird beim Kauf
-- exakt für seinen Fixplatz ausgerechnet, nicht pauschal versprochen.

-- === 1. Schulferien ==================================================
-- Ohne sie lässt sich die Lektionszahl nicht ehrlich berechnen. In einem
-- Quartal liegen je nach Jahreszeit 8 bis 11 wöchentliche Lektionen —
-- eine Pauschalzahl wäre in der Hälfte der Fälle falsch.

create table if not exists public.schulferien (
  id uuid primary key default gen_random_uuid(),
  bezeichnung text not null,
  start_datum date not null,
  end_datum date not null,
  erstellt_am timestamptz not null default now(),
  check (end_datum >= start_datum)
);

create index if not exists schulferien_zeitraum_idx
  on public.schulferien (start_datum, end_datum);

comment on table public.schulferien is
  'Unterrichtsfreie Zeiten. Grundlage für die Lektionsberechnung eines Abos – in diesen Zeiträumen entstehen keine Termine und es wird keine Laufzeit verlängert.';

alter table public.schulferien enable row level security;

drop policy if exists "Alle lesen Schulferien" on public.schulferien;
create policy "Alle lesen Schulferien" on public.schulferien
  for select using (true);

drop policy if exists "Nur Admin pflegt Schulferien" on public.schulferien;
create policy "Nur Admin pflegt Schulferien" on public.schulferien
  for all using (is_admin()) with check (is_admin());

-- === 2. Abo-Felder am Paket ==========================================

alter table public.packages
  -- 'halbjahr' = 6 Monate, 'jahr' = 12 Monate
  add column if not exists abo_variante text,
  -- Vertraglich zugesicherte Lektionszahl, beim Kauf berechnet.
  add column if not exists abo_lektionen smallint,
  -- Gleichbleibender Monatsbetrag über die Laufzeit.
  add column if not exists monatsbetrag numeric(10,2),
  -- Beginn und Ende der Abo-Periode (unabhängig von starts_at/expires_at,
  -- die weiterhin die technische Gültigkeit tragen).
  add column if not exists periode_start date,
  add column if not exists periode_ende date;

do $$ begin
  alter table public.packages add constraint packages_abo_variante_check
    check (abo_variante is null or abo_variante in ('halbjahr','jahr'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.packages add constraint packages_monatsbetrag_check
    check (monatsbetrag is null or monatsbetrag >= 0);
exception when duplicate_object then null; end $$;

comment on column public.packages.abo_lektionen is
  'Beim Kauf für den konkreten Fixplatz berechnete Lektionszahl – bereits abzüglich Schulferien.';

-- === 3. Preisstufen fürs Abo =========================================
-- Eigene Spalten statt Zweckentfremdung von price_10er/price_20er: die alten
-- Pakete laufen noch aus und brauchen ihre Preise weiter.

alter table public.profiles
  add column if not exists price_halbjahr numeric(8,2),
  add column if not exists price_jahr numeric(8,2);

update public.profiles
   set price_halbjahr = coalesce(price_halbjahr, price_20er, 65.00),
       price_jahr     = coalesce(price_jahr, round(coalesce(price_20er, 65.00) * 0.92, 2))
 where role = 'student';

alter table public.profiles
  alter column price_halbjahr set default 65.00,
  alter column price_jahr set default 60.00;

comment on column public.profiles.price_halbjahr is
  'Lektionspreis im Halbjahresabo (6 Monate).';
comment on column public.profiles.price_jahr is
  'Lektionspreis im Jahresabo (12 Monate) – tiefer als das Halbjahr, als Gegenwert für die längere Bindung.';

-- === 4. Schulferien Kanton Zürich (Startbestand) =====================

insert into public.schulferien (bezeichnung, start_datum, end_datum) values
  ('Herbstferien 2026',      '2026-10-05','2026-10-16'),
  ('Weihnachtsferien 2026',  '2026-12-21','2027-01-01'),
  ('Sportferien 2027',       '2027-02-08','2027-02-19'),
  ('Frühlingsferien 2027',   '2027-04-19','2027-04-30'),
  ('Sommerferien 2027',      '2027-07-19','2027-08-20'),
  ('Herbstferien 2027',      '2027-10-04','2027-10-15'),
  ('Weihnachtsferien 2027',  '2027-12-20','2028-01-02')
on conflict do nothing;
