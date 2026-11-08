-- ============================================================
-- Bewerbungen als Lehrperson
--
-- David, 8. November 2026: Seite „Lehrperson werden“ mit einer Bewerbung
-- in Schritten. Im Admin laufen Bewerbungen durch Stufen (neu, Gespräch,
-- Probelektion, Zusage, Absage), mit vorbereiteten Mails.
--
-- Nur David liest. Die öffentliche Bewerbung schreibt der Server nach
-- Prüfung mit dem Service-Schlüssel.
-- ============================================================

create table if not exists public.bewerbungen (
  id uuid primary key default gen_random_uuid(),
  vorname text not null,
  nachname text not null,
  email text not null,
  telefon text,
  wohnort text,
  mindestens_20 boolean,
  -- Du und Klavier
  spielt_seit int,
  stile text[] not null default '{}',
  lieblingssong text,
  -- Unterrichten
  unterrichtserfahrung text check (unterrichtserfahrung in ('keine', 'etwas', 'viel')),
  unterrichtserfahrung_text text,
  ausbildung text,
  altersgruppen text[] not null default '{}',
  akkord_erklaerung text,
  wichtig_im_unterricht text,
  -- Wann und wo
  verfuegbarkeit jsonb not null default '{}'::jsonb,
  unterrichtsorte text[] not null default '{}',
  mobilitaet text[] not null default '{}',
  lektionen_pro_woche text,
  start_ab date,
  leitbild_passt boolean not null default false,
  -- Bearbeitung durch David
  status text not null default 'neu'
    check (status in ('neu', 'gespraech', 'probelektion', 'zusage', 'absage', 'zurueckgezogen')),
  notizen text,
  teacher_id uuid references public.teachers(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create unique index if not exists bewerbungen_email_offen_idx
  on public.bewerbungen (lower(email))
  where status in ('neu', 'gespraech', 'probelektion');

create index if not exists bewerbungen_status_idx on public.bewerbungen (status, erstellt_am desc);

alter table public.bewerbungen enable row level security;
drop policy if exists "Nur Admin verwaltet Bewerbungen" on public.bewerbungen;
create policy "Nur Admin verwaltet Bewerbungen" on public.bewerbungen
  for all using (is_admin()) with check (is_admin());

drop trigger if exists audit on public.bewerbungen;
create trigger audit after insert or update or delete on public.bewerbungen
  for each row execute function public.audit_schreiben();
