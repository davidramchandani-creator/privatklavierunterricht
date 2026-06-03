-- Rechnungs-Lektionsdatum mit Uhrzeit speichern (vorher nur DATE → Zeit ging
-- verloren). Backfill aus den zugehörigen Terminen.
ALTER TABLE invoices
  ALTER COLUMN lesson_date TYPE timestamptz USING lesson_date::timestamptz;

UPDATE invoices
SET lesson_date = a.start_at
FROM appointments a
WHERE invoices.appointment_id = a.id
  AND a.start_at IS NOT NULL;
