-- 034: Doppelte Rechnungen auf Datenbankebene verhindern.
-- Angewendet am 2026-08-09.
--
-- Die Anwendung prüft vor dem Anlegen zwar, ob es schon eine Rechnung gibt,
-- aber Lesen und Schreiben sind zwei Schritte: zwei gleichzeitige Aufrufe
-- (Cron trifft auf "Jetzt stellen", Doppelklick, zwei Browsertabs) sehen
-- beide "noch keine Rechnung" und legen beide eine an. Der Schüler bekäme
-- zwei Zahlungsaufforderungen für dieselbe Position.

-- Pro Rate höchstens eine Rechnung.
create unique index if not exists invoices_one_per_instalment
  on public.invoices (instalment_id)
  where instalment_id is not null;

-- Pro Termin höchstens eine aktive Rechnung. Archivierte zählen nicht mit,
-- damit nach einer Stornierung neu fakturiert werden kann.
create unique index if not exists invoices_one_active_per_appointment
  on public.invoices (appointment_id)
  where appointment_id is not null and status <> 'archived';
