-- ============================================================
-- Wiederholung gescheiterter Mails
--
-- Gescheiterte Mails wurden nie erneut versucht und niemandem gemeldet. Im
-- Bestand stehen fünf davon — Terminbestätigungen und
-- Zahlungsaufforderungen, die nie angekommen sind, weil der Mailversand an
-- jenem Tag nicht erreichbar war. Ein einzelner Aussetzer beim Anbieter
-- kostete damit dauerhaft eine Nachricht, ohne dass es jemand merkte.
--
-- Mit einem Zähler lässt sich begrenzt wiederholen: ein vorübergehender
-- Ausfall heilt sich von selbst, ein dauerhaft kaputter Eintrag (etwa ohne
-- auflösbaren Empfänger) läuft nicht ewig weiter und verstopft den Lauf.
-- ============================================================

alter table scheduled_emails
  add column if not exists versuche integer not null default 0;

comment on column scheduled_emails.versuche is
  'Anzahl Sendeversuche. Ab MAX_SENDEVERSUCHE wird nicht mehr wiederholt.';

create index if not exists scheduled_emails_wiederholung
  on scheduled_emails (status, send_at)
  where status in ('pending', 'failed');
