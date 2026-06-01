-- Fix termine status constraint to include 'angefragt'
ALTER TABLE termine DROP CONSTRAINT IF EXISTS termine_status_check;
ALTER TABLE termine ADD CONSTRAINT termine_status_check
  CHECK (status IN ('angefragt','bestaetigt','storniert','abgeschlossen'));
