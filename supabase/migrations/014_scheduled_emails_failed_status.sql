-- Migration 014: 'failed' als gültigen Status für scheduled_emails zulassen.
-- Der Cron-Versand (api/cron/send-emails) setzt bei Fehlern status='failed'.
-- Bisher verletzte das die CHECK-Constraint → der gesamte Cron-Lauf crashte,
-- sobald eine einzige Mail fehlschlug.

alter table public.scheduled_emails
  drop constraint if exists scheduled_emails_status_check;

alter table public.scheduled_emails
  add constraint scheduled_emails_status_check
  check (status in ('pending', 'sent', 'cancelled', 'failed'));
