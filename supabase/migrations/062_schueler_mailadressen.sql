-- ============================================================
-- Mehrere Mailadressen je Schüler, mit Kategorien
--
-- Der Fall, der das ausgelöst hat: Maurice. Die Rechnungen sollen zum
-- Vater, die Terminerinnerungen zur Mutter. Mit einer einzigen Adresse im
-- Profil geht das nicht, und das Hin und Her hat am Ende dazu geführt, dass
-- Profil und Login-Konto verschiedene Adressen trugen.
--
-- ── Modell ─────────────────────────────────────────────────
--
-- `profiles.email` bleibt die Hauptadresse. Sie ist die Adresse des
-- Login-Kontos, und Login-Mails (Passwort, Zugang) gehen immer nur dorthin.
-- Welche Kategorien sie sonst noch bekommt, steht in `mail_kategorien`.
--
-- Weitere Adressen liegen in `schueler_mailadressen`, je mit den
-- Kategorien, die sie bekommen sollen.
--
-- Vier Kategorien, nicht vierzig Mailtypen: zahlungen, termine, abo,
-- sonstiges. Die Zuordnung Mailtyp → Kategorie steht im Code
-- (mail-kategorien.ts), damit eine neue Mail nicht vergessen werden kann.
--
-- ── Regel ──────────────────────────────────────────────────
--
-- Hat eine Kategorie keine einzige Adresse, springt die Hauptadresse ein.
-- Es geht nie eine Mail verloren, nur weil ein Häkchen fehlt.
-- ============================================================

create table if not exists public.schueler_mailadressen (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references public.profiles (id) on delete cascade,
  email text not null,
  -- Für wen die Adresse ist, z. B. „Roland (Vater)". Nur zur Anzeige.
  bezeichnung text,
  -- Erlaubt: zahlungen, termine, abo, sonstiges
  kategorien text[] not null default '{}',
  erstellt_am timestamptz not null default now(),
  unique (student_id, email)
);

comment on table public.schueler_mailadressen is
  'Weitere Mailadressen eines Schülers, je mit den Kategorien, die sie erhalten. Die Hauptadresse steht in profiles.email.';
comment on column public.schueler_mailadressen.kategorien is
  'Teilmenge von: zahlungen, termine, abo, sonstiges';

create index if not exists schueler_mailadressen_schueler_idx
  on public.schueler_mailadressen (student_id);

-- Die Hauptadresse bekommt standardmässig alles. Wer nur Zahlungen dorthin
-- will, wählt die anderen ab.
alter table public.profiles
  add column if not exists mail_kategorien text[] not null
    default '{zahlungen,termine,abo,sonstiges}';

comment on column public.profiles.mail_kategorien is
  'Welche Mailkategorien an die Hauptadresse (email) gehen. Login-Mails immer.';

-- ── Nur der Admin ──────────────────────────────────────────
alter table public.schueler_mailadressen enable row level security;

drop policy if exists "Nur Admin verwaltet Mailadressen" on public.schueler_mailadressen;
create policy "Nur Admin verwaltet Mailadressen"
  on public.schueler_mailadressen
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
