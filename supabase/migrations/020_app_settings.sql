-- 020_app_settings.sql
-- Einfache Key/Value-Tabelle für Runtime-Einstellungen (z.B. deaktivierte E-Mail-Typen).

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lesen und schreiben"
  ON app_settings
  USING (is_admin())
  WITH CHECK (is_admin());

-- Standard: alle E-Mail-Typen aktiviert (leere Disabled-Liste).
INSERT INTO app_settings (key, value)
VALUES ('email_disabled_types', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
