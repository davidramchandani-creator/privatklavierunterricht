-- ============================================================
-- Monatsabrechnung: Einnahmen und Ausgaben für die Steuererklärung
-- Angewendet am 2026-08-20.
--
-- Die Einnahmen stehen schon im System (bezahlte Rechnungen). Was fehlt,
-- sind die Ausgaben — Benzin, Mittagessen, Noten. Die weiss nur David, und
-- er weiss sie nur solange er sich erinnert. Darum fragt das System kurz
-- vor Monatsende danach, statt im Februar eine Schuhschachtel zu erwarten.
--
-- Gezählt wird nach Zahlungseingang (`invoices.paid_at`), nicht nach
-- Lektionsdatum: Das ist die übliche Einnahmen-Ausgaben-Rechnung für
-- Selbstständige und entspricht dem, was tatsächlich auf dem Konto war.
-- ============================================================

create table public.betriebsausgaben (
  id          uuid primary key default gen_random_uuid(),
  datum       date not null,
  kategorie   text not null check (kategorie in
                ('fahrt','verpflegung','material','weiterbildung','sonstiges')),
  betrag      numeric(10,2) not null check (betrag > 0),
  notiz       text,
  erstellt_am timestamptz not null default now()
);

create index betriebsausgaben_datum on public.betriebsausgaben (datum desc);

comment on table public.betriebsausgaben is
  'Geschäftsausgaben für die Einnahmen-Ausgaben-Rechnung. Nur Admin.';

-- Pro Monat festhalten, ob die Ausgaben erfasst sind und ob schon erinnert
-- wurde. Ohne diese Zeile würde die Erinnerung jeden Tag der letzten fünf
-- gehen — fünf gleiche Mails sind schlimmer als keine.
create table public.monatsabschluss (
  monat            date primary key,
  ausgaben_erfasst boolean not null default false,
  erinnert_am      timestamptz,
  notiz            text,
  erstellt_am      timestamptz not null default now()
);

comment on column public.monatsabschluss.monat is
  'Erster Tag des Monats, als Schlüssel.';

alter table public.betriebsausgaben enable row level security;
alter table public.monatsabschluss enable row level security;

-- Beides geht ausschliesslich David etwas an. Kein Schüler hat hier etwas
-- zu suchen, auch nicht lesend.
create policy ausgaben_nur_admin on public.betriebsausgaben
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

create policy abschluss_nur_admin on public.monatsabschluss
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );
