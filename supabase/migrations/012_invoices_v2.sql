-- ============================================================
-- Milestone 9: invoices Tabelle auf Spec-konformes Schema bringen
-- ============================================================

-- 1. Neue Sequence falls noch nicht vorhanden (ist in 006 bereits da)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'invoice_number_seq') THEN
    CREATE SEQUENCE invoice_number_seq START 1000;
  END IF;
END $$;

-- 2. Neue Spalten hinzufügen (IF NOT EXISTS via DO-Block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='appointment_id') THEN
    ALTER TABLE invoices ADD COLUMN appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payer_name') THEN
    ALTER TABLE invoices ADD COLUMN payer_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payer_address') THEN
    ALTER TABLE invoices ADD COLUMN payer_address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='access_token') THEN
    ALTER TABLE invoices ADD COLUMN access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='lesson_date') THEN
    ALTER TABLE invoices ADD COLUMN lesson_date TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='pdf_url') THEN
    ALTER TABLE invoices ADD COLUMN pdf_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='paid_at') THEN
    ALTER TABLE invoices ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3. Alte Status-Werte migrieren bevor Constraint geändert wird
UPDATE invoices SET status = 'unpaid'  WHERE status IN ('draft','sent','overdue');
UPDATE invoices SET status = 'archived' WHERE status = 'cancelled';

-- 4. Alten Status-Constraint entfernen und neuen setzen
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('unpaid','pending_confirmation','paid','rejected','archived','cancelled'));

-- 5. Status-Default auf 'unpaid' setzen
ALTER TABLE invoices ALTER COLUMN status SET DEFAULT 'unpaid';

-- 6. Alte method-Werte migrieren
UPDATE invoices SET method = 'twint' WHERE method = 'cash';
UPDATE invoices SET method = 'qr'    WHERE method = 'bank_transfer';
UPDATE invoices SET method = 'twint' WHERE method IS NULL;

-- 7. Alten method-Constraint entfernen und neuen setzen
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_method_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_method_check
  CHECK (method IN ('twint','qr'));

-- 8. invoice_number Default auf PIANO-Format setzen
ALTER TABLE invoices ALTER COLUMN invoice_number
  SET DEFAULT ('PIANO-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::text, 4, '0'));

-- 9. Index auf appointment_id
CREATE INDEX IF NOT EXISTS idx_invoices_appointment ON invoices(appointment_id);

-- 10. RLS: sicherstellen dass RLS aktiviert ist
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- 11. Schüler dürfen nur ihre eigenen Rechnungen lesen
DROP POLICY IF EXISTS "student_read_own_invoices" ON invoices;
CREATE POLICY "student_read_own_invoices" ON invoices
  FOR SELECT
  USING (student_id = auth.uid());

-- 12. Admin (service role) darf alles – wird via Service-Role-Client umgangen
-- Admin-Update-Policy (für Server Actions mit Admin-Client)
DROP POLICY IF EXISTS "admin_all_invoices" ON invoices;
CREATE POLICY "admin_all_invoices" ON invoices
  FOR ALL
  USING (true)
  WITH CHECK (true);
