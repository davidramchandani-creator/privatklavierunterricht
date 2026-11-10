-- ============================================================
-- Probelektionen, die David selbst einträgt (10. November 2026)
--
-- David: „es muss auch möglich sein probelektion von meiner seite an
-- anzulegen damit es auch den kalender blockiert und die mail raus geht,
-- mail ist aber nicht muss."
--
-- Eine Probelektion gehört zu einer Person ohne Konto, darum kein Termin in
-- `appointments` (dort ist student_id Pflicht). Eine geplante Probelektion
-- sperrt die Zeit in der Buchungs-Engine wie eine Lektion im Studio.
-- ============================================================

create table if not exists public.probelektionen (
  id uuid primary key default gen_random_uuid(),
  anfrage_id uuid references public.anfragen(id) on delete set null,
  vorname text not null,
  nachname text not null default '',
  email text,
  telefon text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'geplant' check (status in ('geplant', 'abgesagt')),
  notiz text,
  teacher_id uuid not null default public.inhaber_teacher_id() references public.teachers(id),
  google_event_id text,
  mail_gesendet_am timestamptz,
  erstellt_am timestamptz not null default now(),
  constraint probelektion_dauer check (end_at > start_at)
);

create index if not exists probelektionen_start_idx on public.probelektionen (start_at);

alter table public.probelektionen enable row level security;

create policy "Nur Admin verwaltet Probelektionen" on public.probelektionen
  for all using (public.is_admin()) with check (public.is_admin());

create trigger audit after insert or update or delete on public.probelektionen
  for each row execute function public.audit_schreiben();
