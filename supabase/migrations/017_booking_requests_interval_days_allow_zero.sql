-- Allow interval_days = 0 in booking_requests (used for single-slot multi-select requests).
-- The old CHECK (interval_days IN (7,14)) was written before multi-slot booking existed.
ALTER TABLE booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_interval_days_check;

ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_interval_days_check
  CHECK (interval_days IN (0, 7, 14));
