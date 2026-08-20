-- ============================================================
-- Externe Schüler
-- Angewendet am 2026-08-20.
--
-- Unterricht, der über eine andere Plattform läuft (Matchspace und
-- ähnliche). David fährt hin, der Termin belegt seinen Abend und seine
-- Route — abgerechnet wird aber dort, nicht hier.
--
-- ── Warum keine eigene Tabelle ──────────────────────────────
--
-- Naheliegend wäre `externe_schueler` neben `profiles`. Dann müssten aber
-- Termine, Kalender, Routenplaner, Zuteilung und Geokodierung jeweils zwei
-- Quellen zusammenführen — an jeder Stelle eine Gelegenheit, die Externen
-- zu vergessen. Genau das soll nicht passieren: Sie sollen überall
-- mitzählen, wo es um Zeit und Wege geht.
--
-- `profiles` hängt an keinem Fremdschlüssel zu `auth.users`. Ein Profil
-- ohne Login ist also möglich, und ein externer Schüler ist genau das:
-- ein Schüler wie jeder andere, nur ohne Konto, ohne Abo und ohne Post.
--
-- Der Preis dafür ist eine Sperre an jeder Stelle, die etwas verschickt
-- oder verrechnet. Die ist billiger als das Zusammenführen zweier Tabellen
-- an einem Dutzend Stellen, und sie fällt auf: Wo `extern` fehlt, geht eine
-- Mail an jemanden ohne Adresse.
-- ============================================================

alter table public.profiles
  add column if not exists extern boolean not null default false,
  add column if not exists plattform text,
  add column if not exists externer_ertrag numeric(10,2);

comment on column public.profiles.extern is
  'Läuft über eine andere Plattform: kein Login, keine Rechnung, keine Mail. Zählt trotzdem in Kalender und Routenplanung.';
comment on column public.profiles.plattform is
  'Woher der Schüler kommt, z. B. Matchspace. Nur zur Übersicht.';
comment on column public.profiles.externer_ertrag is
  'Was David pro Lektion dort verdient. Wird nirgends verrechnet, dient dem Abwägen weiter Wege.';

-- E-Mail wird optional: Externe haben oft keine, und eine erfundene Adresse
-- wäre gefährlich — irgendwann schickt jemand doch etwas dorthin.
alter table public.profiles alter column email drop not null;

-- Ein Konto ohne Mailadresse darf es nur extern geben. Alle anderen melden
-- sich damit an; ohne Adresse gäbe es keinen Weg ins Portal.
do $$ begin
  alter table public.profiles
    add constraint profiles_email_nur_extern_optional
    check (email is not null or extern = true);
exception when duplicate_object then null; end $$;

-- === Die Vereinbarung ================================================
--
-- Was extern vereinbart wurde: fester Tag, feste Zeit, Rhythmus, Umfang.
-- Eigene Tabelle statt Felder in `profiles`, weil sich das ändern kann
-- (anderer Tag ab Februar) und weil `packages` hier nicht passt: An dem
-- hängen Rechnungen, Raten und Portal-Logik, die es alle nicht geben soll.

create table if not exists public.externe_vereinbarungen (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,

  rhythmus text not null default 'woechentlich'
    check (rhythmus in ('woechentlich', 'zweiwoechentlich')),

  -- 0 = So … 6 = Sa, wie überall im System.
  wochentag smallint not null check (wochentag between 0 and 6),
  zeit time not null,
  lektion_minuten smallint not null default 45
    check (lektion_minuten between 15 and 180),

  -- Bei zweiwöchentlich: 0 = gerade, 1 = ungerade Kalenderwochen.
  woche_paritaet smallint check (woche_paritaet in (0, 1)),

  start_datum date not null,

  -- Umfang: entweder eine Anzahl Termine, oder unbefristet.
  -- `anzahl` null heisst unbefristet; dann hält der Cron rund ein halbes
  -- Jahr Vorlauf im Kalender.
  anzahl smallint check (anzahl is null or anzahl > 0),

  aktiv boolean not null default true,
  notiz text,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

comment on table public.externe_vereinbarungen is
  'Was mit einem externen Schüler abgemacht ist. Grundlage für die Terminserie.';
comment on column public.externe_vereinbarungen.anzahl is
  'Anzahl Termine, oder null für unbefristet. Unbefristete wächst der Cron laufend nach.';

create index if not exists externe_vereinbarungen_student_idx
  on public.externe_vereinbarungen (student_id);
create index if not exists externe_vereinbarungen_offen_idx
  on public.externe_vereinbarungen (aktiv) where aktiv and anzahl is null;

alter table public.externe_vereinbarungen enable row level security;

-- Nur der Admin. Externe Schüler haben kein Konto, es gibt also niemanden
-- sonst, der das lesen dürfte.
drop policy if exists "Nur Admin verwaltet externe Vereinbarungen"
  on public.externe_vereinbarungen;
create policy "Nur Admin verwaltet externe Vereinbarungen"
  on public.externe_vereinbarungen
  for all using (is_admin()) with check (is_admin());

-- Termine aus einer solchen Vereinbarung. Bleibt beim Löschen der
-- Vereinbarung erhalten (Historie), verliert nur den Verweis.
alter table public.appointments
  add column if not exists externe_vereinbarung_id uuid
    references public.externe_vereinbarungen(id) on delete set null;

create index if not exists appointments_externe_idx
  on public.appointments (externe_vereinbarung_id)
  where externe_vereinbarung_id is not null;
