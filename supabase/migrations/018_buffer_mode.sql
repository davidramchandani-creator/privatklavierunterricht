-- Pufferzeit-Einschränkung aufheben (nur 15/30 war zu restriktiv)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_buffer_time_minutes_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_buffer_time_minutes_check
  CHECK (buffer_time_minutes BETWEEN 1 AND 120);

-- Puffermodus: 'fixed' (manuell) oder 'auto' (Google Maps berechnet)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS buffer_mode TEXT
  NOT NULL DEFAULT 'fixed'
  CHECK (buffer_mode IN ('fixed', 'auto'));
