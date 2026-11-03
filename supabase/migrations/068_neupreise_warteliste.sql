-- ============================================================
-- Neue Preise für neue Schüler und Warteliste
--
-- David, 3. November 2026: Er ist fast ausgebucht.
--
--   Neue Schüler      Einzellektion 100, Semesterabo 85, Jahresabo 80 pro
--                     Lektion. Gilt sofort, aber nur für neu angelegte
--                     Profile (Vorgabewerte der Spalten). Bestehende
--                     Schüler behalten, was in ihrem Profil steht.
--   Warteliste        Ist kein fester Platz mehr frei, meldet man sich auf
--                     der Webseite auf die Warteliste an. David kann auch
--                     selbst eintragen und einen frei gewordenen Platz per
--                     Mail anbieten.
--
-- Die Zahlen stehen auch in src/lib/neupreise.ts. Beide Stellen müssen
-- übereinstimmen.
-- ============================================================

alter table public.profiles
  alter column price_single set default 100.00,
  alter column price_halbjahr set default 85.00,
  alter column price_jahr set default 80.00;

-- Die alte Preistabelle (Admin-Seite /admin/preise, nicht mehr verlinkt)
-- zeigte noch 105/70/65. Angleichen, damit dort nichts Falsches steht.
update public.preise set preis_pro_lektion = 100.00 where typ = 'einzellektion';
update public.preise set preis_pro_lektion = 85.00 where typ = 'halbjahr';
update public.preise set preis_pro_lektion = 80.00 where typ = 'jahr';

-- ── Warteliste ─────────────────────────────────────────────
create table if not exists public.warteliste (
  id uuid primary key default gen_random_uuid(),
  vorname text not null,
  nachname text not null,
  email text not null,
  telefon text,
  nachricht text,
  wunsch_rhythmus text not null default 'egal'
    check (wunsch_rhythmus in ('woechentlich', 'zweiwoechentlich', 'egal')),
  -- 1 = Montag … 5 = Freitag. Leer = egal.
  wunsch_tage smallint[] not null default '{}',
  wunsch_zeiten text,
  quelle text not null default 'webseite'
    check (quelle in ('webseite', 'admin')),
  status text not null default 'wartend'
    check (status in ('wartend', 'angeboten', 'zugesagt', 'abgelehnt', 'entfernt')),
  -- Angebot eines frei gewordenen Platzes
  angebot_text text,
  angebot_frist timestamptz,
  angebot_token text unique,
  angeboten_am timestamptz,
  beantwortet_am timestamptz,
  student_id uuid references public.profiles(id) on delete set null,
  notizen text,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

comment on table public.warteliste is
  'Interessenten, für die gerade kein fester Platz frei ist. Reihenfolge = erstellt_am.';

-- Doppelanmeldung verhindern: dieselbe Adresse nur einmal offen.
create unique index if not exists warteliste_email_offen_idx
  on public.warteliste (lower(email))
  where status in ('wartend', 'angeboten');

create index if not exists warteliste_status_idx
  on public.warteliste (status, erstellt_am);

alter table public.warteliste enable row level security;

-- Nur Admin. Die öffentliche Anmeldung und die Antwort auf ein Angebot
-- laufen über Server Actions mit dem Service-Client, nach Prüfung.
drop policy if exists "Nur Admin verwaltet Warteliste" on public.warteliste;
create policy "Nur Admin verwaltet Warteliste" on public.warteliste
  for all using (is_admin()) with check (is_admin());
