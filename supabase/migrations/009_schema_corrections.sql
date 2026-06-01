-- ============================================================
-- Migration 009: Schema corrections to match spec
-- Drops and recreates tables from migration 006 with correct schemas
-- ALTERs profiles to add missing columns
-- ============================================================

-- ── Step 1: Drop tables in reverse FK order ────────────────

DROP TABLE IF EXISTS scheduled_emails CASCADE;
DROP TABLE IF EXISTS package_extensions CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS time_block_rules CASCADE;
DROP TABLE IF EXISTS time_blocks CASCADE;
DROP TABLE IF EXISTS absences CASCADE;
DROP TABLE IF EXISTS reschedule_requests CASCADE;
DROP TABLE IF EXISTS proposals CASCADE;
DROP TABLE IF EXISTS booking_requests CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS packages CASCADE;

-- ── Step 2: ALTER profiles to add missing columns ──────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS price_single NUMERIC(8,2) NOT NULL DEFAULT 85.00,
  ADD COLUMN IF NOT EXISTS price_10er NUMERIC(8,2) NOT NULL DEFAULT 70.00,
  ADD COLUMN IF NOT EXISTS price_20er NUMERIC(8,2) NOT NULL DEFAULT 65.00,
  ADD COLUMN IF NOT EXISTS travel_surcharge NUMERIC(8,2) NOT NULL DEFAULT 0.00;

-- ── Step 3: Recreate packages ─────────────────────────────

CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('single','10er','20er')),
  lessons_total SMALLINT NOT NULL CHECK (lessons_total > 0),
  lessons_used SMALLINT NOT NULL DEFAULT 0,
  name TEXT,
  price_per_lesson NUMERIC(8,2) NOT NULL CHECK (price_per_lesson >= 0),
  total_price NUMERIC(10,2),
  payment_method TEXT CHECK (payment_method IN ('twint','qr')),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','exhausted','cancelled','expired')),
  paused BOOLEAN NOT NULL DEFAULT false,
  pause_remaining_seconds INTEGER,
  paused_at TIMESTAMPTZ,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_lessons_used CHECK (lessons_used <= lessons_total)
);

-- ── Step 4: Recreate appointments ─────────────────────────

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','pending','cancelled','completed','no_show')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','pending_confirmation','paid','rejected','archived','cancelled')),
  payment_method TEXT CHECK (payment_method IN ('twint','qr')),
  payment_date DATE,
  source TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('public_request','admin_proposal','direct','reschedule')),
  series_id UUID,
  notes TEXT,
  google_event_id TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_appointment_times CHECK (end_at > start_at)
);

CREATE INDEX idx_appointments_student ON appointments(student_id);
CREATE INDEX idx_appointments_start ON appointments(start_at);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_series ON appointments(series_id) WHERE series_id IS NOT NULL;

-- ── Step 5: Recreate booking_requests ─────────────────────

CREATE TABLE booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  desired_start TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','withdrawn')),
  type TEXT NOT NULL DEFAULT 'public_request',
  lessons_count SMALLINT NOT NULL DEFAULT 1 CHECK (lessons_count IN (1,5,10)),
  interval_days SMALLINT NOT NULL DEFAULT 7 CHECK (interval_days IN (7,14)),
  notes TEXT,
  calculated_price NUMERIC(10,2),
  processed_at TIMESTAMPTZ,
  created_appointment_ids UUID[] DEFAULT '{}',
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_requests_student ON booking_requests(student_id);
CREATE INDEX idx_booking_requests_status ON booking_requests(status);

-- ── Step 6: Recreate proposals ────────────────────────────

CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proposed_start TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected')),
  lessons_count SMALLINT NOT NULL DEFAULT 1,
  interval_days SMALLINT NOT NULL DEFAULT 7 CHECK (interval_days IN (7,14)),
  notes TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposals_student ON proposals(student_id);
CREATE INDEX idx_proposals_status ON proposals(status);

-- ── Step 7: Recreate reschedule_requests ──────────────────

CREATE TABLE reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  original_start TIMESTAMPTZ NOT NULL,
  proposed_start TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','withdrawn')),
  request_type TEXT NOT NULL DEFAULT 'reschedule' CHECK (request_type IN ('reschedule','alternative')),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reschedule_student ON reschedule_requests(student_id);
CREATE INDEX idx_reschedule_appointment ON reschedule_requests(appointment_id);

-- ── Step 8: Recreate absences ─────────────────────────────

CREATE TABLE absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'admin' CHECK (scope IN ('admin','student')),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  auto_extend BOOLEAN NOT NULL DEFAULT true,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_absence_dates CHECK (end_date >= start_date),
  CONSTRAINT check_student_scope CHECK (scope = 'admin' OR student_id IS NOT NULL)
);

CREATE INDEX idx_absences_dates ON absences(start_date, end_date);
CREATE INDEX idx_absences_student ON absences(student_id) WHERE student_id IS NOT NULL;

-- ── Step 9: Recreate time_blocks ──────────────────────────

CREATE TABLE time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_times CHECK (end_time > start_time)
);

CREATE INDEX idx_time_blocks_date ON time_blocks(date);

-- ── Step 10: Recreate time_block_rules ────────────────────

CREATE TABLE time_block_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  interval_days SMALLINT NOT NULL DEFAULT 7 CHECK (interval_days IN (7,14)),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_times CHECK (end_time > start_time)
);

-- ── Step 11: Recreate invoices ────────────────────────────

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE
    DEFAULT ('PIANO-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::text, 4, '0')),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  amount NUMERIC(8,2) NOT NULL CHECK (amount >= 0),
  payer_name TEXT,
  payer_address TEXT,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','pending_confirmation','paid','rejected','archived')),
  method TEXT CHECK (method IN ('twint','qr')),
  pdf_url TEXT,
  access_token TEXT DEFAULT gen_random_uuid()::text,
  lesson_date DATE,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_invoices_student ON invoices(student_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- ── Step 12: Recreate package_extensions ──────────────────

CREATE TABLE package_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  absence_id UUID REFERENCES absences(id) ON DELETE SET NULL,
  days_added INTEGER NOT NULL,
  reason TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Step 13: Recreate scheduled_emails ────────────────────

CREATE TABLE scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled')),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_emails_status ON scheduled_emails(status);
CREATE INDEX idx_scheduled_emails_send_at ON scheduled_emails(send_at) WHERE status = 'pending';

-- ── Step 14: Enable RLS on all new tables ─────────────────

ALTER TABLE packages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reschedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences           ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_block_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails   ENABLE ROW LEVEL SECURITY;

-- ── Step 15: Recreate RLS policies ────────────────────────

-- packages
CREATE POLICY "Schüler liest eigene Pakete" ON packages
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin schreibt Pakete" ON packages
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin aktualisiert Pakete" ON packages
  FOR UPDATE USING (is_admin());
CREATE POLICY "Nur Admin löscht Pakete" ON packages
  FOR DELETE USING (is_admin());

-- appointments
CREATE POLICY "Schüler liest eigene Termine" ON appointments
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin erstellt Termine" ON appointments
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin aktualisiert Termine" ON appointments
  FOR UPDATE USING (is_admin());
CREATE POLICY "Nur Admin löscht Termine" ON appointments
  FOR DELETE USING (is_admin());

-- booking_requests
CREATE POLICY "Schüler liest eigene Anfragen" ON booking_requests
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Schüler erstellt Anfragen" ON booking_requests
  FOR INSERT WITH CHECK (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Admin oder Schüler aktualisiert Anfragen" ON booking_requests
  FOR UPDATE USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin löscht Anfragen" ON booking_requests
  FOR DELETE USING (is_admin());

-- proposals
CREATE POLICY "Schüler liest eigene Vorschläge" ON proposals
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin erstellt Vorschläge" ON proposals
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin oder Schüler aktualisiert Vorschläge" ON proposals
  FOR UPDATE USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin löscht Vorschläge" ON proposals
  FOR DELETE USING (is_admin());

-- reschedule_requests
CREATE POLICY "Schüler liest eigene Umbuchungsanfragen" ON reschedule_requests
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Admin oder Schüler erstellt Umbuchungsanfragen" ON reschedule_requests
  FOR INSERT WITH CHECK (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Admin oder Schüler aktualisiert Umbuchungsanfragen" ON reschedule_requests
  FOR UPDATE USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin löscht Umbuchungsanfragen" ON reschedule_requests
  FOR DELETE USING (is_admin());

-- absences
CREATE POLICY "Schüler liest eigene Abwesenheiten" ON absences
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Schüler erstellt eigene Abwesenheiten" ON absences
  FOR INSERT WITH CHECK (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Schüler oder Admin aktualisiert Abwesenheiten" ON absences
  FOR UPDATE USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Schüler oder Admin löscht Abwesenheiten" ON absences
  FOR DELETE USING (student_id = own_profile_id() OR is_admin());

-- time_blocks
CREATE POLICY "Zeitblöcke öffentlich lesen" ON time_blocks
  FOR SELECT USING (true);
CREATE POLICY "Nur Admin schreibt Zeitblöcke" ON time_blocks
  FOR ALL USING (is_admin());

-- time_block_rules
CREATE POLICY "Verfügbarkeitsregeln öffentlich lesen" ON time_block_rules
  FOR SELECT USING (true);
CREATE POLICY "Nur Admin schreibt Verfügbarkeitsregeln" ON time_block_rules
  FOR ALL USING (is_admin());

-- invoices
CREATE POLICY "Schüler liest eigene Rechnungen" ON invoices
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin erstellt Rechnungen" ON invoices
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin aktualisiert Rechnungen" ON invoices
  FOR UPDATE USING (is_admin());
CREATE POLICY "Nur Admin löscht Rechnungen" ON invoices
  FOR DELETE USING (is_admin());

-- package_extensions
CREATE POLICY "Schüler liest eigene Paketverlängerungen" ON package_extensions
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin schreibt Paketverlängerungen" ON package_extensions
  FOR ALL USING (is_admin());

-- scheduled_emails
CREATE POLICY "Nur Admin liest/schreibt geplante E-Mails" ON scheduled_emails
  FOR ALL USING (is_admin());
