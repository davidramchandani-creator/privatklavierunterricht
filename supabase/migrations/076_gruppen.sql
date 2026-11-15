-- ============================================================
-- Gruppenunterricht Schritt 2: feste Gruppen im Admin (15. November 2026)
--
-- Regeln von David (5. November 2026, lib/gruppenunterricht.ts):
--   zu zweit oder zu dritt, 60 Minuten, fester Platz,
--   jede Person hat ein eigenes Abo, eigene Raten und eigene Rechnungen,
--   fehlt jemand, findet die Lektion für die anderen statt, alle zahlen.
--
-- Darum keine neue Abrechnung: Jedes Mitglied bekommt ein gewöhnliches Abo
-- in `packages` und eigene Termine in `appointments`, beide mit `gruppe_id`.
-- Die Gruppe selbst hält nur zusammen, was alle teilen: Platz und Rhythmus.
--
-- Die alten Gruppenkurse (019, group_courses) sind etwas anderes: offene
-- Kurse mit Anmeldung pro Session. Sie bleiben unberührt.
-- ============================================================

create table if not exists public.gruppen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  groesse smallint not null check (groesse in (2, 3)),
  abo_variante text not null check (abo_variante in ('halbjahr', 'jahr')),
  rhythmus text not null check (rhythmus in ('woechentlich', 'zweiwoechentlich')),
  fixplatz_weekday smallint not null check (fixplatz_weekday between 0 and 6),
  fixplatz_time time not null,
  fixplatz_week_parity smallint check (fixplatz_week_parity in (0, 1)),
  lektion_minuten smallint not null default 60 check (lektion_minuten > 0),
  periode_start date not null,
  status text not null default 'aktiv' check (status in ('aktiv', 'beendet')),
  notiz text,
  teacher_id uuid not null default public.inhaber_teacher_id() references public.teachers(id),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

alter table public.packages
  add column if not exists gruppe_id uuid references public.gruppen(id) on delete set null;
alter table public.appointments
  add column if not exists gruppe_id uuid references public.gruppen(id) on delete set null;

create index if not exists packages_gruppe_idx
  on public.packages (gruppe_id) where gruppe_id is not null;
-- Die Mitglieder einer Gruppenlektion findet man über Gruppe und Beginn.
create index if not exists appointments_gruppe_start_idx
  on public.appointments (gruppe_id, start_at) where gruppe_id is not null;

alter table public.gruppen enable row level security;

create policy "Admin verwaltet Gruppen" on public.gruppen
  for all using (public.is_admin()) with check (public.is_admin());

-- Ein Mitglied darf seine eigene Gruppe lesen (Name im Portal).
create policy "Mitglied liest eigene Gruppe" on public.gruppen
  for select using (
    exists (
      select 1 from public.packages p
      where p.gruppe_id = gruppen.id and p.student_id = auth.uid()
    )
  );

create trigger audit after insert or update or delete on public.gruppen
  for each row execute function public.audit_schreiben();
