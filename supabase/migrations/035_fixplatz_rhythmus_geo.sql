-- 035: Fixplatz-Modell — Rhythmus, fester Slot, Ausfälle, Geokoordinaten
--
-- Hintergrund: Der Umsatzhebel bei Hausbesuchen ist nicht der Preis, sondern
-- die Route. Ein fester Wochentag/Uhrzeit über die ganze Paketlaufzeit macht
-- die Route planbar und spart Fahr- und Verwaltungszeit. Flex bleibt möglich,
-- kostet aber Aufschlag, weil es genau diese Planbarkeit zerstört.

-- === 1. packages: Rhythmus und Fixplatz ==============================

alter table public.packages
  -- 'woechentlich' | 'zweiwoechentlich' — bestimmt die Laufzeit:
  -- 10er wö 4 Mt / zwei 6 Mt, 20er wö 8 Mt / zwei 12 Mt.
  add column if not exists rhythmus text,
  -- 'fix'  = fester Slot, ganze Serie im Voraus gebucht
  -- 'flex' = freie Buchung pro Lektion (wie bisher), mit Aufschlag
  add column if not exists booking_mode text not null default 'flex',
  -- Fixplatz: Wochentag (0=So … 6=Sa) und Ortszeit des wiederkehrenden Slots
  add column if not exists fixplatz_weekday smallint,
  add column if not exists fixplatz_time time,
  -- Kalenderwochen-Parität bei zweiwöchentlichem Rhythmus: 0 = gerade KW,
  -- 1 = ungerade KW. Erlaubt es, zwei Schüler abwechselnd auf denselben
  -- Slot zu legen (der eigentliche Kapazitätsgewinn).
  add column if not exists fixplatz_week_parity smallint,
  -- Prozentualer Aufschlag, der beim Kauf auf den Lektionspreis kam
  -- (0 bei Fixplatz, >0 bei Flex). Nur zur Nachvollziehbarkeit.
  add column if not exists flex_surcharge_percent numeric(5,2) not null default 0;

do $$ begin
  alter table public.packages add constraint packages_rhythmus_check
    check (rhythmus is null or rhythmus in ('woechentlich','zweiwoechentlich'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.packages add constraint packages_booking_mode_check
    check (booking_mode in ('fix','flex'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.packages add constraint packages_fixplatz_weekday_check
    check (fixplatz_weekday is null or fixplatz_weekday between 0 and 6);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.packages add constraint packages_fixplatz_parity_check
    check (fixplatz_week_parity is null or fixplatz_week_parity in (0,1));
exception when duplicate_object then null; end $$;

-- Ein Fixplatz braucht Wochentag, Uhrzeit und Rhythmus – sonst lässt sich die
-- Serie nicht erzeugen. Wird bewusst als Constraint erzwungen und nicht nur
-- im Code geprüft: hier hängt die ganze Terminserie dran.
do $$ begin
  alter table public.packages add constraint packages_fixplatz_complete_check
    check (
      booking_mode <> 'fix'
      or (rhythmus is not null and fixplatz_weekday is not null
          and fixplatz_time is not null)
    );
exception when duplicate_object then null; end $$;

comment on column public.packages.rhythmus is
  'woechentlich | zweiwoechentlich – bestimmt Laufzeit und Serienabstand.';
comment on column public.packages.booking_mode is
  'fix = fester Slot über die ganze Laufzeit; flex = freie Buchung pro Lektion.';
comment on column public.packages.fixplatz_week_parity is
  'Nur bei zweiwoechentlich: 0 = gerade Kalenderwoche, 1 = ungerade.';

-- Bestandspakete sind alle Flex (so wurden sie gekauft).
update public.packages set booking_mode = 'flex' where booking_mode is null;

-- === 2. appointments: Herkunft und Ausfall-Kennzeichnung =============

alter table public.appointments
  -- true = aus der Fixplatz-Serie erzeugt (nicht einzeln gebucht)
  add column if not exists is_fixplatz boolean not null default false,
  -- Wenn dieser Termin ein Ersatz für einen ausgefallenen ist:
  add column if not exists ersetzt_appointment_id uuid
    references public.appointments(id) on delete set null,
  -- Wer den Ausfall verursacht hat – entscheidet über die Kompensation.
  add column if not exists ausfall_verursacher text,
  add column if not exists ausfall_gemeldet_am timestamptz;

do $$ begin
  alter table public.appointments add constraint appointments_ausfall_verursacher_check
    check (ausfall_verursacher is null
           or ausfall_verursacher in ('schueler','admin'));
exception when duplicate_object then null; end $$;

create index if not exists appointments_fixplatz_idx
  on public.appointments (student_id, start_at)
  where is_fixplatz;

-- === 3. Ausfälle und ihre Kompensation ===============================
-- Ein Ausfall ist nie einfach "weg". Er durchläuft eine feste Kaskade:
-- Ausweichtermin gleiche Woche → Folgewoche → Laufzeitgutschrift →
-- (nur manuell) Rückerstattung. Diese Tabelle hält fest, wo er steht.

create table if not exists public.lesson_ausfaelle (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid references public.packages(id) on delete set null,
  -- Wer abgesagt hat.
  verursacher text not null check (verursacher in ('schueler','admin')),
  -- Original-Startzeit, bevor der Termin storniert wurde.
  original_start timestamptz not null,
  grund text,
  -- Weniger als 24 h vorher abgesagt? Nur relevant, wenn der Schüler absagt.
  kurzfristig boolean not null default false,
  -- Wo in der Kaskade der Fall gerade steht.
  status text not null default 'offen'
    check (status in ('offen','ersatz_gebucht','gutschrift','verfallen','rueckerstattet')),
  -- Gebuchter Ersatztermin, falls Stufe 1 oder 2 geklappt hat.
  ersatz_appointment_id uuid references public.appointments(id) on delete set null,
  -- Stufe 3: Laufzeit verlängert statt Ersatztermin.
  gutschrift_tage smallint,
  erledigt_am timestamptz,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  -- Ein Termin fällt nur einmal aus.
  unique (appointment_id)
);

create index if not exists lesson_ausfaelle_offen_idx
  on public.lesson_ausfaelle (student_id, status)
  where status = 'offen';

comment on table public.lesson_ausfaelle is
  'Ausgefallene Lektionen und ihre Kompensation. Kaskade: Ersatz gleiche Woche → Folgewoche → Laufzeitgutschrift → Rückerstattung (nur manuell).';
comment on column public.lesson_ausfaelle.kurzfristig is
  'Schülerabsage unter 24 h – keine automatische Kompensation, Kulanz bleibt manuell.';

create or replace function public.touch_lesson_ausfaelle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.aktualisiert_am := now();
  return new;
end;
$$;

drop trigger if exists lesson_ausfaelle_touch on public.lesson_ausfaelle;
create trigger lesson_ausfaelle_touch
  before update on public.lesson_ausfaelle
  for each row execute function public.touch_lesson_ausfaelle();

alter table public.lesson_ausfaelle enable row level security;

drop policy if exists "Schüler liest eigene Ausfälle" on public.lesson_ausfaelle;
create policy "Schüler liest eigene Ausfälle" on public.lesson_ausfaelle
  for select using (student_id = own_profile_id() or is_admin());

drop policy if exists "Nur Admin schreibt Ausfälle" on public.lesson_ausfaelle;
create policy "Nur Admin schreibt Ausfälle" on public.lesson_ausfaelle
  for insert with check (is_admin());

drop policy if exists "Nur Admin aktualisiert Ausfälle" on public.lesson_ausfaelle;
create policy "Nur Admin aktualisiert Ausfälle" on public.lesson_ausfaelle
  for update using (is_admin());

drop policy if exists "Nur Admin löscht Ausfälle" on public.lesson_ausfaelle;
create policy "Nur Admin löscht Ausfälle" on public.lesson_ausfaelle
  for delete using (is_admin());

-- === 4. Geokoordinaten für die Routenplanung =========================
-- Adressen werden einmal geokodiert und gespeichert. Ohne Koordinaten kann
-- der Routenplaner den Schüler nicht einplanen – er wird dann sichtbar als
-- "Adresse fehlt" gemeldet statt still ignoriert.

alter table public.profiles
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geocoded_am timestamptz,
  -- Welche Adresse zu diesen Koordinaten gehört. Ändert sich die Adresse,
  -- stimmt der Hash nicht mehr und es wird neu geokodiert.
  add column if not exists geocode_quelle text,
  add column if not exists geocode_adresse text;

do $$ begin
  alter table public.profiles add constraint profiles_lat_check
    check (lat is null or lat between -90 and 90);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_lng_check
    check (lng is null or lng between -180 and 180);
exception when duplicate_object then null; end $$;

comment on column public.profiles.geocode_adresse is
  'Adresse, die zu lat/lng geführt hat. Weicht sie von adresse ab, ist die Geokodierung veraltet.';

-- === 5. Fahrzeiten-Cache =============================================
-- Fahrzeiten zwischen zwei Punkten ändern sich praktisch nie. Einmal geholt,
-- immer wiederverwendbar – spart API-Aufrufe und macht den Planer schnell.

create table if not exists public.travel_times (
  id uuid primary key default gen_random_uuid(),
  -- Gerundete Koordinaten als Schlüssel (5 Nachkommastellen ≈ 1 m).
  from_lat double precision not null,
  from_lng double precision not null,
  to_lat double precision not null,
  to_lng double precision not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  distance_meters integer,
  -- 'schaetzung' = Luftlinie × Umwegfaktor, 'osrm' = echte Route,
  -- 'manuell' = von Hand korrigiert (überschreibt alles andere).
  quelle text not null default 'schaetzung'
    check (quelle in ('schaetzung','osrm','manuell')),
  erstellt_am timestamptz not null default now(),
  unique (from_lat, from_lng, to_lat, to_lng)
);

create index if not exists travel_times_from_idx
  on public.travel_times (from_lat, from_lng);

alter table public.travel_times enable row level security;

drop policy if exists "Nur Admin sieht Fahrzeiten" on public.travel_times;
create policy "Nur Admin sieht Fahrzeiten" on public.travel_times
  for select using (is_admin());

drop policy if exists "Nur Admin schreibt Fahrzeiten" on public.travel_times;
create policy "Nur Admin schreibt Fahrzeiten" on public.travel_times
  for all using (is_admin()) with check (is_admin());

-- === 6. Wann ein Schüler grundsätzlich kann ==========================
-- Für die Routenplanung und die Fixplatz-Wahl: welche Wochentage und
-- Zeitfenster kommen für diesen Schüler überhaupt in Frage. Ohne Eintrag
-- gilt: alle Unterrichtszeiten möglich.

create table if not exists public.student_verfuegbarkeit (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  wochentag smallint not null check (wochentag between 0 and 6),
  fruehestens time,
  spaetestens time,
  erstellt_am timestamptz not null default now(),
  unique (student_id, wochentag)
);

create index if not exists student_verfuegbarkeit_student_idx
  on public.student_verfuegbarkeit (student_id);

comment on table public.student_verfuegbarkeit is
  'Wochentage/Zeitfenster, an denen ein Schüler grundsätzlich kann. Kein Eintrag = keine Einschränkung.';

alter table public.student_verfuegbarkeit enable row level security;

drop policy if exists "Schüler liest eigene Verfügbarkeit" on public.student_verfuegbarkeit;
create policy "Schüler liest eigene Verfügbarkeit" on public.student_verfuegbarkeit
  for select using (student_id = own_profile_id() or is_admin());

drop policy if exists "Schüler pflegt eigene Verfügbarkeit" on public.student_verfuegbarkeit;
create policy "Schüler pflegt eigene Verfügbarkeit" on public.student_verfuegbarkeit
  for all using (student_id = own_profile_id() or is_admin())
  with check (student_id = own_profile_id() or is_admin());

-- === 7. Gespeicherte Routenpläne =====================================
-- Ein Plan ist ein Vorschlag, kein Fakt. Er wird gerechnet, angeschaut,
-- angepasst und erst auf Knopfdruck in echte Fixplätze übernommen.

create table if not exists public.routenplaene (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  -- Kompletter Plan als JSON: Zuteilung Schüler → Tag/Zeit/Parität,
  -- Fahrzeiten, Kennzahlen. Struktur siehe src/lib/routing.ts.
  plan jsonb not null,
  gesamt_fahrzeit_sekunden integer,
  lektionen_anzahl smallint,
  angewendet_am timestamptz,
  erstellt_am timestamptz not null default now()
);

alter table public.routenplaene enable row level security;

drop policy if exists "Nur Admin sieht Routenpläne" on public.routenplaene;
create policy "Nur Admin sieht Routenpläne" on public.routenplaene
  for all using (is_admin()) with check (is_admin());
