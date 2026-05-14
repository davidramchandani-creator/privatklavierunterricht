-- ============================================================
-- Anfragen: öffentliche Buchungsanfragen (z.B. Probelektion)
-- ============================================================

CREATE TABLE anfragen (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vorname      TEXT NOT NULL,
  nachname     TEXT NOT NULL,
  email        TEXT NOT NULL,
  telefon      TEXT,
  nachricht    TEXT,
  wunschtermin TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'neu' CHECK (status IN ('neu', 'bearbeitet', 'abgesagt')),
  erstellt_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE anfragen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Öffentlich Anfrage einreichen" ON anfragen
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin liest Anfragen" ON anfragen
  FOR SELECT USING (is_admin());

CREATE POLICY "Admin aktualisiert Anfragen" ON anfragen
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admin löscht Anfragen" ON anfragen
  FOR DELETE USING (is_admin());

CREATE INDEX idx_anfragen_status ON anfragen(status);
CREATE INDEX idx_anfragen_erstellt ON anfragen(erstellt_am);
