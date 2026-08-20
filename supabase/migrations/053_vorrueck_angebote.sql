-- ============================================================
-- Vorrück-Angebote: die Lücke nach einer Absage weitergeben
-- Angewendet am 2026-08-20.
--
-- Sagt jemand ab, entsteht mitten im Abend ein Loch. Der Schüler direkt
-- danach könnte früher kommen und das Loch schliessen — aber nur, wenn man
-- ihn fragt. Genau diese Frage ist ein Vorrück-Angebot: unverbindlich,
-- einmalig, mit klarer Antwortmöglichkeit im Portal.
--
-- Bewusst eine eigene Tabelle statt reschedule_requests: Dort fragt der
-- Schüler und der Admin entscheidet. Hier fragt das System und der
-- **Schüler** entscheidet. Beides in eine Tabelle zu pressen hiesse, jede
-- Auswertung mit Sonderfällen zu spicken.
-- ============================================================

create table public.vorrueck_angebote (
  id             uuid primary key default gen_random_uuid(),
  -- Der Termin, der früher stattfinden könnte.
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  -- Der abgesagte Termin, der die Lücke gerissen hat. Nur zur Nachvollzieh-
  -- barkeit; wird er gelöscht, bleibt das Angebot bestehen.
  ausgeloest_von uuid references public.appointments(id) on delete set null,
  alter_beginn   timestamptz not null,
  neuer_beginn   timestamptz not null,
  status         text not null default 'offen'
                 check (status in ('offen','angenommen','abgelehnt','verfallen')),
  erstellt_am    timestamptz not null default now(),
  beantwortet_am timestamptz
);

-- Höchstens ein offenes Angebot pro Termin. Zwei parallele Fragen an
-- denselben Schüler für denselben Termin wären verwirrend, und die zweite
-- Antwort würde die erste stillschweigend überschreiben.
create unique index vorrueck_offen_einmalig
  on public.vorrueck_angebote (appointment_id)
  where status = 'offen';

alter table public.vorrueck_angebote enable row level security;

-- Schüler sehen ihre eigenen Angebote (fürs Portal-Banner). Antworten läuft
-- über Server-Actions mit Service-Role, darum keine Update-Policy.
create policy vorrueck_student_select on public.vorrueck_angebote
  for select using (student_id = auth.uid());

create policy vorrueck_admin_alles on public.vorrueck_angebote
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
