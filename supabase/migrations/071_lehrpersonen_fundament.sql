-- ============================================================
-- Mehrere Lehrpersonen, Schritt 1a: Fundament
--
-- David, 6. November 2026: Ab Februar 2027 unterrichtet mindestens eine
-- angestellte Lehrperson. Alles läuft über David. Siehe
-- docs/Mehrere-Lehrpersonen-Plan.md.
--
-- Diese Migration ergänzt nur, sie löscht und überschreibt nichts:
--   1. Rolle „lehrperson“ in beiden Rollensystemen, Hilfsfunktionen.
--   2. Tabelle teachers, David als Inhaber und Lehrperson 1.
--   3. teacher_id auf allen Tabellen, die einer Lehrperson gehören. Die
--      Vorgabe ist David, darum funktioniert jeder bestehende Code weiter,
--      ohne die Spalte zu kennen. Bestehende Zeilen werden auf David gesetzt.
--   4. Audit-Log für jede Änderung.
--   5. RLS: Arbeitszeiten und Sperren nicht mehr öffentlich lesbar; die
--      Admin-Prüfung überall über is_admin() statt profiles.role.
--
-- Sicherungskopie aller Tabellen davor: Schema backup_20261106.
-- ============================================================

-- ── 1. Rollen ──────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin', 'student', 'lehrperson']));

alter table public.profile_roles drop constraint if exists profile_roles_role_check;
alter table public.profile_roles add constraint profile_roles_role_check
  check (role = any (array['admin', 'schueler', 'lehrperson']));

create or replace function public.is_lehrperson()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from profile_roles where user_id = auth.uid() and role = 'lehrperson'
  );
$$;

-- ── 2. Lehrpersonen ────────────────────────────────────────
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  -- Login der Lehrperson (bei David sein Admin-Profil)
  profile_id uuid unique references public.profiles(id) on delete set null,
  vorname text not null,
  nachname text not null,
  foto_url text,
  -- Öffentlich ist nur, was David freigegeben hat.
  kurztext text,
  kurztext_entwurf text,
  kurztext_freigegeben_am timestamptz,
  unterrichtsorte text[] not null default '{}',
  -- Intern, nie öffentlich
  unterrichtsadresse text,
  startpunkt_adresse text,
  startpunkt_lat double precision,
  startpunkt_lng double precision,
  region text not null default 'Winterthur',
  altersgruppen text[] not null default '{}',
  status text not null default 'aktiv' check (status in ('aktiv', 'inaktiv')),
  startdatum date,
  -- Bruttolohn pro Lektion inklusive Ferienentschädigung (David: CHF 50)
  lohn_pro_lektion numeric(8, 2),
  -- 8.33 % bei 4 Wochen Ferien, 10.64 % bei 5 Wochen (unter 20 Jahren)
  ferien_prozent numeric(5, 2) not null default 8.33,
  ist_inhaber boolean not null default false,
  sortierung int not null default 0,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  check (unterrichtsorte <@ array['studio', 'zuhause', 'hausbesuch']::text[])
);

create unique index if not exists teachers_ein_inhaber on public.teachers (ist_inhaber) where ist_inhaber;

comment on table public.teachers is
  'Lehrpersonen. David ist ist_inhaber. Adresse und Startpunkt sind intern, öffentlich nur Vorname, Foto, freigegebener Kurztext, Orte, Region, Altersgruppen.';

alter table public.teachers enable row level security;

drop policy if exists "Admin verwaltet Lehrpersonen" on public.teachers;
create policy "Admin verwaltet Lehrpersonen" on public.teachers
  for all using (is_admin()) with check (is_admin());

drop policy if exists "Lehrperson liest sich selbst" on public.teachers;
create policy "Lehrperson liest sich selbst" on public.teachers
  for select using (profile_id = auth.uid());

-- David als Lehrperson 1
insert into public.teachers (profile_id, vorname, nachname, unterrichtsorte, unterrichtsadresse, status, ist_inhaber, startdatum)
select p.id, p.vorname, p.nachname, array['studio'], 'Sattleracherstrasse 59, 8413 Neftenbach', 'aktiv', true, date '2024-01-01'
from public.profiles p
join public.profile_roles r on r.user_id = p.id and r.role = 'admin'
where not exists (select 1 from public.teachers where ist_inhaber)
order by p.erstellt_am
limit 1;

create or replace function public.inhaber_teacher_id()
returns uuid language sql stable security definer
set search_path = public, pg_temp as $$
  select id from teachers where ist_inhaber limit 1;
$$;

create or replace function public.own_teacher_id()
returns uuid language sql stable security definer
set search_path = public, pg_temp as $$
  select id from teachers where profile_id = auth.uid() limit 1;
$$;

-- ── 3. teacher_id überall ──────────────────────────────────
do $$
declare
  t text;
  pflicht text[] := array[
    'appointments', 'packages', 'booking_requests', 'proposals',
    'reschedule_requests', 'absences', 'time_blocks', 'time_block_rules',
    'admin_verfuegbarkeit', 'planungsrunden', 'lesson_ausfaelle', 'lektionsnotizen'
  ];
begin
  foreach t in array pflicht loop
    execute format('alter table public.%I add column if not exists teacher_id uuid references public.teachers(id)', t);
    execute format('alter table public.%I alter column teacher_id set default public.inhaber_teacher_id()', t);
    execute format('update public.%I set teacher_id = public.inhaber_teacher_id() where teacher_id is null', t);
    execute format('alter table public.%I alter column teacher_id set not null', t);
    execute format('create index if not exists %I on public.%I (teacher_id)', t || '_teacher_idx', t);
  end loop;
end $$;

-- Schüler gehören einer Lehrperson. Für Admin- und Lehrpersonen-Profile
-- bleibt das Feld leer.
alter table public.profiles add column if not exists teacher_id uuid references public.teachers(id);
alter table public.profiles alter column teacher_id set default public.inhaber_teacher_id();
update public.profiles set teacher_id = public.inhaber_teacher_id() where role = 'student' and teacher_id is null;
update public.profiles set teacher_id = null where role <> 'student';
create index if not exists profiles_teacher_idx on public.profiles (teacher_id);

-- ── 4. Audit-Log ───────────────────────────────────────────
create table if not exists public.audit_log (
  id bigserial primary key,
  tabelle text not null,
  datensatz_id text,
  aktion text not null check (aktion in ('INSERT', 'UPDATE', 'DELETE')),
  alt jsonb,
  neu jsonb,
  -- auth.uid() bei Aktionen mit Sitzung (z. B. Lehrpersonen-Portal).
  -- Leer, wenn der Server mit dem Service-Schlüssel schreibt (Admin-Aktion
  -- oder automatischer Job).
  akteur uuid,
  wann timestamptz not null default now()
);

create index if not exists audit_log_tabelle_idx on public.audit_log (tabelle, datensatz_id, wann desc);
create index if not exists audit_log_wann_idx on public.audit_log (wann desc);

alter table public.audit_log enable row level security;
drop policy if exists "Nur Admin liest Audit-Log" on public.audit_log;
create policy "Nur Admin liest Audit-Log" on public.audit_log
  for select using (is_admin());

create or replace function public.audit_schreiben()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  a jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  alt_diff jsonb := '{}'::jsonb;
  neu_diff jsonb := '{}'::jsonb;
  k text;
begin
  -- Apple-Kalender-Import schreibt bei jedem Abgleich neu, das wäre nur Lärm.
  if tg_table_name = 'time_blocks' and coalesce(n->>'quelle', a->>'quelle') = 'apple' then
    return coalesce(new, old);
  end if;

  -- Geheimnisse nie ins Protokoll: Kalender-Tokens, Rechnungs- und
  -- Angebotslinks, private Kalender-URL.
  a := a - array['kalender_token', 'access_token', 'angebot_token'];
  n := n - array['kalender_token', 'access_token', 'angebot_token'];
  if tg_table_name = 'app_settings'
     and coalesce(n->>'key', a->>'key') in ('apple_kalender', 'kalender_token_admin') then
    if a ? 'value' then a := jsonb_set(a, '{value}', '"***"'); end if;
    if n ? 'value' then n := jsonb_set(n, '{value}', '"***"'); end if;
  end if;

  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if (a->k) is distinct from (n->k) and k not in ('aktualisiert_am', 'updated_at') then
        alt_diff := alt_diff || jsonb_build_object(k, a->k);
        neu_diff := neu_diff || jsonb_build_object(k, n->k);
      end if;
    end loop;
    if neu_diff = '{}'::jsonb then
      return new;
    end if;
    a := alt_diff;
    n := neu_diff;
  end if;

  insert into audit_log (tabelle, datensatz_id, aktion, alt, neu, akteur)
  values (
    tg_table_name,
    coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id', to_jsonb(new)->>'key', to_jsonb(old)->>'key'),
    tg_op, a, n, auth.uid()
  );
  return coalesce(new, old);
end $$;

do $$
declare
  t text;
  tabellen text[] := array[
    'teachers', 'profiles', 'profile_roles', 'packages', 'package_instalments',
    'appointments', 'invoices', 'absences', 'time_blocks', 'time_block_rules',
    'admin_verfuegbarkeit', 'semester', 'schulferien', 'preise', 'app_settings',
    'booking_requests', 'reschedule_requests', 'proposals', 'warteliste',
    'lektionsnotizen', 'lesson_ausfaelle', 'planungsrunden', 'planungs_antworten'
  ];
begin
  foreach t in array tabellen loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format(
      'create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_schreiben()',
      t
    );
  end loop;
end $$;

-- ── 5. RLS ─────────────────────────────────────────────────
-- Arbeitszeiten und Sperren sind nicht mehr öffentlich. Gelesen werden sie
-- ohnehin nur über den Server (Service-Schlüssel) oder im Admin.
drop policy if exists "Verfügbarkeit öffentlich lesen" on public.admin_verfuegbarkeit;
create policy "Admin oder eigene Lehrperson liest Verfügbarkeit" on public.admin_verfuegbarkeit
  for select using (is_admin() or teacher_id = own_teacher_id());

drop policy if exists "Zeitblöcke öffentlich lesen" on public.time_blocks;
create policy "Admin oder eigene Lehrperson liest Zeitblöcke" on public.time_blocks
  for select using (is_admin() or teacher_id = own_teacher_id());

drop policy if exists "Verfügbarkeitsregeln öffentlich lesen" on public.time_block_rules;
create policy "Admin oder eigene Lehrperson liest Regeln" on public.time_block_rules
  for select using (is_admin() or teacher_id = own_teacher_id());

-- Admin-Prüfung einheitlich über is_admin() (profile_roles).
drop policy if exists "Nur Admin sieht Lektionsnotizen" on public.lektionsnotizen;
create policy "Nur Admin sieht Lektionsnotizen" on public.lektionsnotizen
  for all using (is_admin()) with check (is_admin());

drop policy if exists vorrueck_admin_alles on public.vorrueck_angebote;
create policy vorrueck_admin_alles on public.vorrueck_angebote
  for all using (is_admin()) with check (is_admin());

drop policy if exists ausgaben_nur_admin on public.betriebsausgaben;
create policy ausgaben_nur_admin on public.betriebsausgaben
  for all using (is_admin()) with check (is_admin());

drop policy if exists abschluss_nur_admin on public.monatsabschluss;
create policy abschluss_nur_admin on public.monatsabschluss
  for all using (is_admin()) with check (is_admin());

drop policy if exists "Nur Admin verwaltet Mailadressen" on public.schueler_mailadressen;
create policy "Nur Admin verwaltet Mailadressen" on public.schueler_mailadressen
  for all using (is_admin()) with check (is_admin());

drop policy if exists "admin verwaltet externe zahlungen" on public.externe_zahlungen;
create policy "admin verwaltet externe zahlungen" on public.externe_zahlungen
  for all using (is_admin()) with check (is_admin());
