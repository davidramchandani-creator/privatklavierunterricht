-- 021_invoice_package_billing.sql
-- Zahlungsstrategie: Paket-Rechnung im Voraus (statt pro Lektion).
-- Ergänzt invoices um Fälligkeit und ein Klartext-Label zur Unterscheidung
-- von Paket-, Lektions- und Storno-Rechnungen in der UI.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS due_date    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS package_id  UUID REFERENCES packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_package_id ON invoices(package_id);

COMMENT ON COLUMN invoices.due_date IS 'Fälligkeit der Rechnung (z.B. Erstellung + 15 Tage bei Paket-Rechnungen).';
COMMENT ON COLUMN invoices.description IS 'Klartext-Label, z.B. "10er-Paket". Paket-Rechnungen haben lesson_date = NULL.';
COMMENT ON COLUMN invoices.package_id IS 'Verknüpfung zur Paket-Rechnung (Vorauszahlung des gesamten Paketpreises).';
