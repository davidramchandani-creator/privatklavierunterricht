-- ============================================================
-- Mehrere Lehrpersonen, Schritt 1b: Fotos, Profiltext, Leitbild
--
--   Fotos       Öffentlicher Bucket „lehrpersonen“. Die Fotos stehen auf
--               der Webseite, darum öffentlich lesbar. Hochladen nur über
--               den Server (Admin).
--   Profiltext  `kurztext` ist das, was öffentlich steht. Ein Entwurf der
--               Lehrperson (`kurztext_entwurf`) wird erst mit Davids
--               Freigabe zu `kurztext`.
--   Leitbild    Versionen von David, jede Lehrperson bestätigt jede
--               Version. David sieht, wer was bestätigt hat.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('lehrpersonen', 'lehrpersonen', true)
on conflict (id) do nothing;

alter table public.teachers add column if not exists kurztext_eingereicht_am timestamptz;

create table if not exists public.leitbild_versionen (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  titel text not null default 'Leitbild',
  inhalt text not null,
  veroeffentlicht_am timestamptz not null default now()
);

create table if not exists public.leitbild_bestaetigungen (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.leitbild_versionen(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  bestaetigt_am timestamptz not null default now(),
  unique (version_id, teacher_id)
);

alter table public.leitbild_versionen enable row level security;
alter table public.leitbild_bestaetigungen enable row level security;

drop policy if exists "Admin verwaltet Leitbild" on public.leitbild_versionen;
create policy "Admin verwaltet Leitbild" on public.leitbild_versionen
  for all using (is_admin()) with check (is_admin());

drop policy if exists "Lehrperson liest Leitbild" on public.leitbild_versionen;
create policy "Lehrperson liest Leitbild" on public.leitbild_versionen
  for select using (is_lehrperson());

drop policy if exists "Admin sieht Bestätigungen" on public.leitbild_bestaetigungen;
create policy "Admin sieht Bestätigungen" on public.leitbild_bestaetigungen
  for all using (is_admin()) with check (is_admin());

drop policy if exists "Lehrperson sieht eigene Bestätigungen" on public.leitbild_bestaetigungen;
create policy "Lehrperson sieht eigene Bestätigungen" on public.leitbild_bestaetigungen
  for select using (teacher_id = own_teacher_id());

-- Bestätigen darf die Lehrperson nur für sich selbst, und nur einmal pro
-- Version (eindeutiger Index). Ändern oder löschen kann sie nichts.
drop policy if exists "Lehrperson bestätigt für sich" on public.leitbild_bestaetigungen;
create policy "Lehrperson bestätigt für sich" on public.leitbild_bestaetigungen
  for insert with check (teacher_id = own_teacher_id() and is_lehrperson());

do $$
declare t text;
begin
  foreach t in array array['leitbild_versionen', 'leitbild_bestaetigungen'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format(
      'create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_schreiben()',
      t
    );
  end loop;
end $$;
