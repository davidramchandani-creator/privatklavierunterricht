-- ============================================================
-- Lektionsnotizen: was in der Stunde lief, und was beim nächsten Mal ansteht
--
-- Bisher gab es pro Schüler nur `profiles.bemerkung` — ein einziges Feld,
-- das den Stand von heute überschreibt und den von letzter Woche vergisst.
-- Damit lässt sich weder vorbereiten noch nachvollziehen, ob ein Stück seit
-- vier Wochen dasselbe Problem hat.
--
-- Eine Notiz je Lektion, nicht je Schüler. Der Unterschied ist der Punkt:
-- Erst dadurch entsteht ein Verlauf.
--
-- ── Warum antippbare Kategorien und nicht nur Freitext ──────
--
-- Freitext schreibt sich am schnellsten und ist danach tot: Man kann nicht
-- fragen „bei wem steht Technik seit einem Monat auf dranbleiben". Die zwei
-- Knopfreihen kosten zwei Antipper und machen genau das möglich. Der
-- Freitext bleibt trotzdem, denn das Stück und die Hausaufgabe lassen sich
-- nicht in Kategorien pressen.
--
-- ── Sichtbarkeit ───────────────────────────────────────────
--
-- Ausschliesslich Admin. Kein Schüler und kein Elternteil sieht das je.
-- Eine Notiz, bei der man sich beim Schreiben zensiert, ist wertlos — und
-- man zensiert sich, sobald der Betroffene mitlesen kann.
-- ============================================================

create table if not exists public.lektionsnotizen (
  id uuid primary key default gen_random_uuid(),

  -- Eine Notiz je Lektion. Das `unique` ist die eigentliche Geschäftsregel:
  -- Nachtragen bearbeitet den bestehenden Eintrag, statt einen zweiten
  -- anzulegen, den später niemand auseinanderhalten kann.
  appointment_id uuid not null unique
    references public.appointments (id) on delete cascade,

  -- Mitgeführt, obwohl über den Termin erreichbar: Der Verlauf eines
  -- Schülers ist die häufigste Abfrage, und ein Join über appointments
  -- kostet bei jeder Dashboard-Anzeige unnötig.
  student_id uuid not null
    references public.profiles (id) on delete cascade,

  -- Woran gearbeitet wurde. Mehrfachauswahl, darum ein Array.
  -- Erlaubt: stueck, technik, theorie, gehoer, improvisation, begleitung
  inhalt text[] not null default '{}',

  -- Wie es lief. Genau eines davon: sitzt, dranbleiben, neu
  verlauf text,

  -- Das Stück, die Stelle, die Beobachtung. Ein Satz genügt.
  woran text,

  -- Was bis zum nächsten Mal geübt werden soll. Steht vor der nächsten
  -- Lektion zuoberst im Dashboard — das ist der eigentliche Zweck.
  hausaufgabe text,

  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

comment on table public.lektionsnotizen is
  'Unterrichtsnotiz je Lektion. Nur für den Admin sichtbar, nie für Schüler.';
comment on column public.lektionsnotizen.inhalt is
  'Mehrfachauswahl: stueck, technik, theorie, gehoer, improvisation, begleitung';
comment on column public.lektionsnotizen.verlauf is
  'Einfachauswahl: sitzt, dranbleiben, neu';

-- Der Verlauf eines Schülers wird immer nach Datum absteigend gelesen.
create index if not exists lektionsnotizen_schueler_idx
  on public.lektionsnotizen (student_id, erstellt_am desc);

-- ── Nur der Admin, ohne Ausnahme ────────────────────────────
alter table public.lektionsnotizen enable row level security;

drop policy if exists "Nur Admin sieht Lektionsnotizen" on public.lektionsnotizen;
create policy "Nur Admin sieht Lektionsnotizen"
  on public.lektionsnotizen
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

-- ── Zeitstempel beim Bearbeiten nachführen ──────────────────
create or replace function public.lektionsnotiz_aktualisiert()
returns trigger
language plpgsql
as $$
begin
  new.aktualisiert_am = now();
  return new;
end;
$$;

drop trigger if exists lektionsnotiz_aktualisiert_trg on public.lektionsnotizen;
create trigger lektionsnotiz_aktualisiert_trg
  before update on public.lektionsnotizen
  for each row execute function public.lektionsnotiz_aktualisiert();
