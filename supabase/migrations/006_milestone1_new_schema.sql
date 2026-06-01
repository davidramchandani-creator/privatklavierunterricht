-- ============================================================
-- Milestone 1: Neues Spec-konformes Schema
-- Koexistiert mit bestehendem Schema (schueler, pakete, termine …)
-- ============================================================

-- ── SEQUENCE für Rechnungsnummern ──────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;

-- ── profiles ──────────────────────────────────────────────
-- Erweiterte Benutzerprofile (Admin + Schüler)
CREATE TABLE profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                 TEXT NOT NULL DEFAULT 'student'
                       CHECK (role IN ('admin','student')),
  vorname              TEXT NOT NULL,
  nachname             TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  telefon              TEXT,
  adresse              TEXT,
  buffer_time_minutes  SMALLINT NOT NULL DEFAULT 15
                       CHECK (buffer_time_minutes IN (15, 30)),
  notizen              TEXT,
  aktiv                BOOLEAN NOT NULL DEFAULT true,
  erstellt_am          TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── packages ──────────────────────────────────────────────
CREATE TABLE packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type              TEXT NOT NULL
                    CHECK (type IN ('trial','single','pack_10','pack_20','custom')),
  lessons_total     SMALLINT NOT NULL CHECK (lessons_total > 0),
  lessons_used      SMALLINT NOT NULL DEFAULT 0,
  price_per_lesson  NUMERIC(8,2) NOT NULL CHECK (price_per_lesson >= 0),
  active            BOOLEAN NOT NULL DEFAULT true,
  valid_until       TIMESTAMPTZ,
  notes             TEXT,
  erstellt_am       TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_lessons_used CHECK (lessons_used <= lessons_total)
);

-- ── appointments ──────────────────────────────────────────
CREATE TABLE appointments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id            UUID REFERENCES packages(id) ON DELETE SET NULL,
  starts_at             TIMESTAMPTZ NOT NULL,
  ends_at               TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed','completed','cancelled','no_show')),
  lesson_number         SMALLINT,
  buffer_after_minutes  SMALLINT NOT NULL DEFAULT 15
                        CHECK (buffer_after_minutes >= 0),
  notes                 TEXT,
  cancelled_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,
  erstellt_am           TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_appointment_times CHECK (ends_at > starts_at)
);

CREATE INDEX idx_appointments_student ON appointments(student_id);
CREATE INDEX idx_appointments_starts  ON appointments(starts_at);
CREATE INDEX idx_appointments_status  ON appointments(status);

-- ── booking_requests ──────────────────────────────────────
CREATE TABLE booking_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id          UUID REFERENCES packages(id) ON DELETE SET NULL,
  requested_starts_at TIMESTAMPTZ NOT NULL,
  requested_ends_at   TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','proposal_sent','expired')),
  notes               TEXT,
  admin_notes         TEXT,
  appointment_id      UUID REFERENCES appointments(id) ON DELETE SET NULL,
  responded_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  erstellt_am         TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_request_times CHECK (requested_ends_at > requested_starts_at)
);

CREATE INDEX idx_booking_requests_student ON booking_requests(student_id);
CREATE INDEX idx_booking_requests_status  ON booking_requests(status);
CREATE INDEX idx_booking_requests_starts  ON booking_requests(requested_starts_at);

-- ── proposals ─────────────────────────────────────────────
-- Admin schlägt alternativen Termin vor
CREATE TABLE proposals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id  UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  proposed_starts_at  TIMESTAMPTZ NOT NULL,
  proposed_ends_at    TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','rejected','expired')),
  message             TEXT,
  responded_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  erstellt_am         TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_proposal_times CHECK (proposed_ends_at > proposed_starts_at)
);

CREATE INDEX idx_proposals_request ON proposals(booking_request_id);
CREATE INDEX idx_proposals_status  ON proposals(status);

-- ── reschedule_requests ───────────────────────────────────
CREATE TABLE reschedule_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id      UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  requested_by        TEXT NOT NULL CHECK (requested_by IN ('admin','student')),
  proposed_starts_at  TIMESTAMPTZ NOT NULL,
  proposed_ends_at    TIMESTAMPTZ NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','rejected','expired')),
  reason              TEXT,
  responded_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  erstellt_am         TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_reschedule_times CHECK (proposed_ends_at > proposed_starts_at)
);

CREATE INDEX idx_reschedule_appointment ON reschedule_requests(appointment_id);

-- ── absences ──────────────────────────────────────────────
-- Schüler meldet sich ab (ganztägig)
CREATE TABLE absences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  starts_on   DATE NOT NULL,
  ends_on     DATE NOT NULL,
  reason      TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_absence_dates CHECK (ends_on >= starts_on)
);

CREATE INDEX idx_absences_student ON absences(student_id);
CREATE INDEX idx_absences_dates   ON absences(starts_on, ends_on);

-- ── time_block_rules ──────────────────────────────────────
-- Wiederkehrende Verfügbarkeitsregeln (ersetzt admin_verfuegbarkeit)
CREATE TABLE time_block_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Mo,…,6=So
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  valid_from  DATE,
  valid_until DATE,
  active      BOOLEAN NOT NULL DEFAULT true,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_rule_times CHECK (end_time > start_time)
);

-- ── time_blocks ───────────────────────────────────────────
-- Einmalige Verfügbarkeits-Überschreibungen (Ferien, Blockierungen)
CREATE TABLE time_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  type        TEXT NOT NULL DEFAULT 'blocked'
              CHECK (type IN ('available','blocked','vacation')),
  notes       TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_block_times CHECK (ends_at > starts_at)
);

CREATE INDEX idx_time_blocks_range ON time_blocks(starts_at, ends_at);

-- ── invoices ──────────────────────────────────────────────
CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE
                 DEFAULT ('RE-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::text, 4, '0')),
  student_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id     UUID REFERENCES packages(id) ON DELETE SET NULL,
  amount         NUMERIC(8,2) NOT NULL CHECK (amount >= 0),
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  method         TEXT CHECK (method IN ('twint','bank_transfer','cash')),
  due_date       DATE,
  paid_at        TIMESTAMPTZ,
  sent_at        TIMESTAMPTZ,
  notes          TEXT,
  erstellt_am    TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_student ON invoices(student_id);
CREATE INDEX idx_invoices_status  ON invoices(status);

-- ── package_extensions ────────────────────────────────────
CREATE TABLE package_extensions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id     UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  new_valid_until TIMESTAMPTZ NOT NULL,
  reason         TEXT,
  erstellt_am    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── scheduled_emails ──────────────────────────────────────
CREATE TABLE scheduled_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email_to      TEXT NOT NULL,
  email_type    TEXT NOT NULL
                CHECK (email_type IN ('invite','reminder','confirmation','invoice','proposal','cancellation','reschedule','general')),
  subject       TEXT NOT NULL,
  body_html     TEXT NOT NULL,
  send_after    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at       TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','sent','failed')),
  related_id    UUID,
  related_type  TEXT,
  error_message TEXT,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_emails_status     ON scheduled_emails(status);
CREATE INDEX idx_scheduled_emails_send_after ON scheduled_emails(send_after)
  WHERE status = 'pending';
