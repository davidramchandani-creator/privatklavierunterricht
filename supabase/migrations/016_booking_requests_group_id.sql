-- Ermöglicht, mehrere Einzelterminanfragen als eine Gruppe zusammenzufassen.
-- Schüler wählt mehrere Slots aus; Admin sieht sie gebündelt und bestätigt/lehnt jeden einzeln ab.
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS group_id uuid;
CREATE INDEX IF NOT EXISTS idx_booking_requests_group ON booking_requests(group_id) WHERE group_id IS NOT NULL;
