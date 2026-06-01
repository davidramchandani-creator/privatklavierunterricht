-- ============================================================
-- RLS Policies für neue Milestone-1-Tabellen
-- ============================================================

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reschedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences           ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_block_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails   ENABLE ROW LEVEL SECURITY;

-- Hilfsfunktion: eigene Profile-ID holen
CREATE OR REPLACE FUNCTION own_profile_id()
RETURNS UUID AS $$
  SELECT id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── profiles ──────────────────────────────────────────────
CREATE POLICY "Eigenes Profil lesen" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "Eigenes Profil aktualisieren" ON profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin());
CREATE POLICY "Nur Admin erstellt Profile" ON profiles
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin löscht Profile" ON profiles
  FOR DELETE USING (is_admin());

-- ── packages ──────────────────────────────────────────────
CREATE POLICY "Schüler liest eigene Pakete" ON packages
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin schreibt Pakete" ON packages
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin aktualisiert Pakete" ON packages
  FOR UPDATE USING (is_admin());
CREATE POLICY "Nur Admin löscht Pakete" ON packages
  FOR DELETE USING (is_admin());

-- ── appointments ──────────────────────────────────────────
CREATE POLICY "Schüler liest eigene Termine" ON appointments
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin erstellt Termine" ON appointments
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin aktualisiert Termine" ON appointments
  FOR UPDATE USING (is_admin());
CREATE POLICY "Nur Admin löscht Termine" ON appointments
  FOR DELETE USING (is_admin());

-- ── booking_requests ──────────────────────────────────────
CREATE POLICY "Schüler liest eigene Anfragen" ON booking_requests
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Schüler erstellt Anfragen" ON booking_requests
  FOR INSERT WITH CHECK (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Admin oder Schüler aktualisiert Anfragen" ON booking_requests
  FOR UPDATE USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin löscht Anfragen" ON booking_requests
  FOR DELETE USING (is_admin());

-- ── proposals ─────────────────────────────────────────────
CREATE POLICY "Schüler liest eigene Vorschläge" ON proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM booking_requests br
      WHERE br.id = proposals.booking_request_id
        AND (br.student_id = own_profile_id() OR is_admin())
    )
  );
CREATE POLICY "Nur Admin erstellt Vorschläge" ON proposals
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin oder Schüler aktualisiert Vorschläge" ON proposals
  FOR UPDATE USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM booking_requests br
      WHERE br.id = proposals.booking_request_id
        AND br.student_id = own_profile_id()
    )
  );
CREATE POLICY "Nur Admin löscht Vorschläge" ON proposals
  FOR DELETE USING (is_admin());

-- ── reschedule_requests ───────────────────────────────────
CREATE POLICY "Schüler liest eigene Umbuchungsanfragen" ON reschedule_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = reschedule_requests.appointment_id
        AND (a.student_id = own_profile_id() OR is_admin())
    )
  );
CREATE POLICY "Admin oder Schüler erstellt Umbuchungsanfragen" ON reschedule_requests
  FOR INSERT WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = reschedule_requests.appointment_id
        AND a.student_id = own_profile_id()
    )
  );
CREATE POLICY "Admin oder Schüler aktualisiert Umbuchungsanfragen" ON reschedule_requests
  FOR UPDATE USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = reschedule_requests.appointment_id
        AND a.student_id = own_profile_id()
    )
  );
CREATE POLICY "Nur Admin löscht Umbuchungsanfragen" ON reschedule_requests
  FOR DELETE USING (is_admin());

-- ── absences ──────────────────────────────────────────────
CREATE POLICY "Schüler liest eigene Abwesenheiten" ON absences
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Schüler erstellt eigene Abwesenheiten" ON absences
  FOR INSERT WITH CHECK (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Schüler oder Admin aktualisiert Abwesenheiten" ON absences
  FOR UPDATE USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Schüler oder Admin löscht Abwesenheiten" ON absences
  FOR DELETE USING (student_id = own_profile_id() OR is_admin());

-- ── time_block_rules ──────────────────────────────────────
CREATE POLICY "Verfügbarkeitsregeln öffentlich lesen" ON time_block_rules
  FOR SELECT USING (true);
CREATE POLICY "Nur Admin schreibt Verfügbarkeitsregeln" ON time_block_rules
  FOR ALL USING (is_admin());

-- ── time_blocks ───────────────────────────────────────────
CREATE POLICY "Zeitblöcke öffentlich lesen" ON time_blocks
  FOR SELECT USING (true);
CREATE POLICY "Nur Admin schreibt Zeitblöcke" ON time_blocks
  FOR ALL USING (is_admin());

-- ── invoices ──────────────────────────────────────────────
CREATE POLICY "Schüler liest eigene Rechnungen" ON invoices
  FOR SELECT USING (student_id = own_profile_id() OR is_admin());
CREATE POLICY "Nur Admin erstellt Rechnungen" ON invoices
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin aktualisiert Rechnungen" ON invoices
  FOR UPDATE USING (is_admin());
CREATE POLICY "Nur Admin löscht Rechnungen" ON invoices
  FOR DELETE USING (is_admin());

-- ── package_extensions ────────────────────────────────────
CREATE POLICY "Schüler liest eigene Paketverlängerungen" ON package_extensions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM packages p
      WHERE p.id = package_extensions.package_id
        AND (p.student_id = own_profile_id() OR is_admin())
    )
  );
CREATE POLICY "Nur Admin schreibt Paketverlängerungen" ON package_extensions
  FOR ALL USING (is_admin());

-- ── scheduled_emails ──────────────────────────────────────
CREATE POLICY "Nur Admin liest/schreibt geplante E-Mails" ON scheduled_emails
  FOR ALL USING (is_admin());
