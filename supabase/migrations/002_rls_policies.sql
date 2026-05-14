-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

ALTER TABLE profile_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE schueler             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pakete               ENABLE ROW LEVEL SECURITY;
ALTER TABLE termine              ENABLE ROW LEVEL SECURITY;
ALTER TABLE zahlungen            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bewertungen          ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_verfuegbarkeit ENABLE ROW LEVEL SECURITY;
ALTER TABLE preise               ENABLE ROW LEVEL SECURITY;

-- Hilfsfunktionen
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profile_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION eigene_schueler_id()
RETURNS UUID AS $$
  SELECT id FROM schueler WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profile_roles
CREATE POLICY "Eigene Rolle lesen" ON profile_roles
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Nur Admin setzt Rollen" ON profile_roles
  FOR ALL USING (is_admin());

-- schueler
CREATE POLICY "Schüler liest eigene Daten" ON schueler
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Nur Admin schreibt Schüler" ON schueler
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin oder Schüler selbst aktualisiert" ON schueler
  FOR UPDATE USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Nur Admin löscht Schüler" ON schueler
  FOR DELETE USING (is_admin());

-- pakete
CREATE POLICY "Schüler liest eigene Pakete" ON pakete
  FOR SELECT USING (schueler_id = eigene_schueler_id() OR is_admin());
CREATE POLICY "Nur Admin schreibt Pakete" ON pakete
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin aktualisiert Pakete" ON pakete
  FOR UPDATE USING (is_admin());

-- termine
CREATE POLICY "Schüler liest eigene Termine" ON termine
  FOR SELECT USING (schueler_id = eigene_schueler_id() OR is_admin());
CREATE POLICY "Schüler oder Admin erstellt Termine" ON termine
  FOR INSERT WITH CHECK (schueler_id = eigene_schueler_id() OR is_admin());
CREATE POLICY "Schüler oder Admin aktualisiert Termine" ON termine
  FOR UPDATE USING (schueler_id = eigene_schueler_id() OR is_admin());
CREATE POLICY "Nur Admin löscht Termine" ON termine
  FOR DELETE USING (is_admin());

-- zahlungen
CREATE POLICY "Schüler liest eigene Zahlungen" ON zahlungen
  FOR SELECT USING (schueler_id = eigene_schueler_id() OR is_admin());
CREATE POLICY "Nur Admin schreibt Zahlungen" ON zahlungen
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Nur Admin aktualisiert Zahlungen" ON zahlungen
  FOR UPDATE USING (is_admin());

-- bewertungen
CREATE POLICY "Öffentliche Bewertungen lesen" ON bewertungen
  FOR SELECT USING (anzeigen = true OR is_admin() OR schueler_id = eigene_schueler_id());
CREATE POLICY "Schüler kann eigene Bewertung eintragen" ON bewertungen
  FOR INSERT WITH CHECK (schueler_id = eigene_schueler_id());
CREATE POLICY "Schüler oder Admin aktualisiert Bewertung" ON bewertungen
  FOR UPDATE USING (schueler_id = eigene_schueler_id() OR is_admin());
CREATE POLICY "Nur Admin löscht Bewertungen" ON bewertungen
  FOR DELETE USING (is_admin());

-- admin_verfuegbarkeit (öffentlich lesbar für Buchungskalender)
CREATE POLICY "Verfügbarkeit öffentlich lesen" ON admin_verfuegbarkeit
  FOR SELECT USING (true);
CREATE POLICY "Nur Admin schreibt Verfügbarkeit" ON admin_verfuegbarkeit
  FOR ALL USING (is_admin());

-- preise (öffentlich lesbar)
CREATE POLICY "Preise öffentlich lesen" ON preise
  FOR SELECT USING (true);
CREATE POLICY "Nur Admin schreibt Preise" ON preise
  FOR ALL USING (is_admin());
