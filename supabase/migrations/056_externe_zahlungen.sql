-- ============================================================
-- Zahlungen externer Schüler
--
-- Externe Schüler bezahlen über ihre Plattform, nicht über dieses System.
-- Bisher wurde ihr Ertrag darum nur hochgerechnet (Lektionen mal
-- hinterlegtem Ertrag) und in der Abrechnung als Schätzung ausgewiesen.
-- Jetzt kann David bestätigen, was wirklich angekommen ist.
--
-- ── Warum eine eigene Tabelle statt `invoices` ──────────────
--
-- Eine Rechnung schleppt alles mit, was ein externer Schüler nie bekommen
-- darf: Empfängeradresse, QR-PDF, Zugriffs-Token, Mailversand. Die Regel
-- „nie Post an Externe" hängt heute daran, dass für sie schlicht keine
-- Rechnung existiert — ein Rechnungssatz mit Sonderfallbehandlung wäre eine
-- Fussangel für jede spätere Änderung. Diese Tabelle kann nichts
-- verschicken.
--
-- ── Warum nicht `appointments.payment_status` ───────────────
--
-- Die Spalte existiert noch aus der WordPress-Zeit, wird von keiner Zeile
-- Code mehr gelesen und enthält veraltete Werte. Sie zu reaktivieren hiesse,
-- zehn alte Datensätze als heutige Wahrheit auszugeben.
-- ============================================================

create table if not exists externe_zahlungen (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  betrag numeric(10, 2) not null check (betrag >= 0),
  -- Wann das Geld da war. Die Abrechnung zählt nach Zahlungseingang, genau
  -- wie bei den eigenen Rechnungen (paid_at).
  bezahlt_am timestamptz not null default now(),
  notiz text,
  erstellt_am timestamptz not null default now()
);

-- Eine Lektion kann nur einmal bezahlt sein. Ohne diesen Index zählte ein
-- doppelter Klick die Einnahme zweimal — in der Steuererklärung.
create unique index if not exists externe_zahlungen_pro_termin
  on externe_zahlungen (appointment_id);

create index if not exists externe_zahlungen_nach_datum
  on externe_zahlungen (bezahlt_am);

alter table externe_zahlungen enable row level security;

-- Nur der Admin. Externe Schüler haben kein Konto; niemand sonst hat hier
-- etwas zu suchen.
drop policy if exists "admin verwaltet externe zahlungen" on externe_zahlungen;
create policy "admin verwaltet externe zahlungen"
  on externe_zahlungen
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
