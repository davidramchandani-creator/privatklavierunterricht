-- ============================================================
-- Migration 019 — Gruppenkurse (Group Courses)
--
-- Neues Angebot neben Einzellektionen. Admin legt Kurse an; Schüler
-- eröffnen offene Sessionen (Slot-Wahl) und treten offenen Sessionen
-- anderer bei. Preis pro Person ist dynamisch nach Teilnehmerzahl und
-- pro Kurs frei einstellbar. Dauer 45 Min (1–2 Pers.) bzw. 90 Min (ab 3).
--
-- Designentscheidung: jeder Teilnehmer ist eine eigene appointments-Zeile
-- (eigene student_id, package_id = NULL), verknüpft über group_session_id.
-- Dadurch bleiben RLS, „Meine Termine", Kalender-Sync und Storno gleich.
-- Teilnehmerzahl wird IMMER aus den appointments abgeleitet (nie gespeichert).
-- ============================================================

-- ── group_courses (Angebot) ────────────────────────────────
CREATE TABLE group_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  max_participants SMALLINT NOT NULL CHECK (max_participants >= 1),
  -- Map Teilnehmerzahl→Preis pro Person pro Lektion, z.B. {"1":70,"2":55,"3":45}
  price_tiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  long_duration_from SMALLINT NOT NULL DEFAULT 3 CHECK (long_duration_from >= 1),
  short_minutes SMALLINT NOT NULL DEFAULT 45 CHECK (short_minutes > 0),
  long_minutes SMALLINT NOT NULL DEFAULT 90 CHECK (long_minutes > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── group_sessions (geteilte Lektion — Quelle der Wahrheit für Zeit/Dauer) ──
CREATE TABLE group_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES group_courses(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','full','cancelled','completed')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_group_session_times CHECK (end_at > start_at)
);

CREATE INDEX idx_group_sessions_course_start ON group_sessions(course_id, start_at);
CREATE INDEX idx_group_sessions_status ON group_sessions(status);

-- ── appointments erweitern: ein Teilnehmer = eine Zeile, verknüpft per session ──
ALTER TABLE appointments
  ADD COLUMN group_session_id UUID REFERENCES group_sessions(id) ON DELETE CASCADE;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_source_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_source_check
  CHECK (source IN ('public_request','admin_proposal','direct','reschedule','group'));

CREATE INDEX idx_appointments_group_session
  ON appointments(group_session_id) WHERE group_session_id IS NOT NULL;

-- ── invoices erweitern (Nachvollziehbarkeit der Gruppen-Abrechnung) ──
ALTER TABLE invoices
  ADD COLUMN group_session_id UUID REFERENCES group_sessions(id) ON DELETE SET NULL;

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE group_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;

-- Kurse: aktive Kurse lesen alle (angemeldete) Nutzer; alles andere nur Admin.
CREATE POLICY "Aktive Kurse öffentlich lesen" ON group_courses
  FOR SELECT USING (status = 'active' OR is_admin());
CREATE POLICY "Nur Admin erstellt Kurse" ON group_courses
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin aktualisiert Kurse" ON group_courses
  FOR UPDATE USING (is_admin());
CREATE POLICY "Nur Admin löscht Kurse" ON group_courses
  FOR DELETE USING (is_admin());

-- Sessionen: jeder Schüler darf Sessionen aktiver Kurse lesen (Sinn: offene
-- Sessionen sehen und beitreten). Schreiben läuft über Server-Actions mit
-- Service-Role (createAdminClient) — daher nur Admin-Schreibpolicies.
CREATE POLICY "Schüler liest Sessionen aktiver Kurse" ON group_sessions
  FOR SELECT USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM group_courses c
      WHERE c.id = course_id AND c.status = 'active'
    )
  );
CREATE POLICY "Nur Admin erstellt Sessionen" ON group_sessions
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin aktualisiert Sessionen" ON group_sessions
  FOR UPDATE USING (is_admin());
CREATE POLICY "Nur Admin löscht Sessionen" ON group_sessions
  FOR DELETE USING (is_admin());
