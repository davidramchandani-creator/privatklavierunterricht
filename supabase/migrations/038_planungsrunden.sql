-- 038: Planungsrunden — Verfügbarkeiten sammeln, dann optimal zuteilen
-- Angewendet am 2026-08-10.
--
-- Kehrt den bisherigen Ablauf um. Vorher wählte jeder Schüler selbst einen
-- freien Platz; die Route war dann, was zufällig dabei herauskam — wer zuerst
-- buchte, bekam den besten Slot, nicht die beste Gesamtroute.
--
-- Neu: alle Verfügbarkeiten einsammeln, dann einmal zuteilen. Dadurch kann
-- der Planer einen Schüler dorthin legen, wo er in die Route passt UND kann.

create table if not exists public.planungsrunden (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  periode_start date,
  frist date not null,
  status text not null default 'offen'
    check (status in ('offen','geschlossen','angewendet')),
  plan jsonb,
  angewendet_am timestamptz,
  erstellt_am timestamptz not null default now()
);

comment on table public.planungsrunden is
  'Eine Runde: Verfügbarkeiten abfragen, Plan rechnen, Termine zuteilen.';

alter table public.planungsrunden enable row level security;

drop policy if exists "Nur Admin verwaltet Planungsrunden" on public.planungsrunden;
create policy "Nur Admin verwaltet Planungsrunden" on public.planungsrunden
  for all using (is_admin()) with check (is_admin());

-- Schüler dürfen die offene Runde sehen, damit das Portal die Frist anzeigen
-- kann. Ohne diese Regel wüssten sie nicht, bis wann sie antworten sollen.
drop policy if exists "Schüler sieht offene Runden" on public.planungsrunden;
create policy "Schüler sieht offene Runden" on public.planungsrunden
  for select using (status = 'offen' or is_admin());

-- === Verfügbarkeit je Runde ==========================================

alter table public.student_verfuegbarkeit
  add column if not exists runde_id uuid
    references public.planungsrunden(id) on delete cascade,
  add column if not exists praeferenz smallint not null default 2;

do $$ begin
  alter table public.student_verfuegbarkeit
    add constraint student_verfuegbarkeit_praeferenz_check
    check (praeferenz between 1 and 3);
exception when duplicate_object then null; end $$;

-- Der bisherige Unique-Index (student_id, wochentag) verhindert mehrere
-- Zeitfenster am selben Tag. Für die Planung ist das zu eng: jemand kann
-- dienstags von 16:30–18:00 und von 19:30–20:30, aber nicht dazwischen.
alter table public.student_verfuegbarkeit
  drop constraint if exists student_verfuegbarkeit_student_id_wochentag_key;

create index if not exists student_verfuegbarkeit_runde_idx
  on public.student_verfuegbarkeit (runde_id);

comment on column public.student_verfuegbarkeit.praeferenz is
  '1 = geht zur Not, 2 = passt, 3 = am liebsten. Der Planer bevorzugt höhere Werte, wenn die Fahrzeit gleich bleibt.';

-- === Wer hat geantwortet =============================================

create table if not exists public.planungs_antworten (
  id uuid primary key default gen_random_uuid(),
  runde_id uuid not null references public.planungsrunden(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  geantwortet_am timestamptz,
  erinnert_am timestamptz,
  bemerkung text,
  erstellt_am timestamptz not null default now(),
  unique (runde_id, student_id)
);

create index if not exists planungs_antworten_runde_idx
  on public.planungs_antworten (runde_id);

alter table public.planungs_antworten enable row level security;

drop policy if exists "Schüler sieht eigene Antwort" on public.planungs_antworten;
create policy "Schüler sieht eigene Antwort" on public.planungs_antworten
  for select using (student_id = own_profile_id() or is_admin());

drop policy if exists "Schüler pflegt eigene Antwort" on public.planungs_antworten;
create policy "Schüler pflegt eigene Antwort" on public.planungs_antworten
  for all using (student_id = own_profile_id() or is_admin())
  with check (student_id = own_profile_id() or is_admin());
