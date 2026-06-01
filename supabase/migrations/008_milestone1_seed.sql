-- ============================================================
-- Seed: Admin-Profil (David) + Test-Schüler + Verfügbarkeit
-- ============================================================

-- Admin: david.privatklavierunterricht@gmail.com
INSERT INTO profiles (id, role, vorname, nachname, email, buffer_time_minutes, aktiv)
VALUES (
  'd119afa5-5441-48a2-b112-6a633d15b3bd',
  'admin',
  'David',
  'Ramchandani',
  'david.privatklavierunterricht@gmail.com',
  15,
  true
)
ON CONFLICT (id) DO UPDATE SET
  role     = EXCLUDED.role,
  vorname  = EXCLUDED.vorname,
  nachname = EXCLUDED.nachname,
  email    = EXCLUDED.email;

-- Test-Schüler: d.ramchandani@bluewin.ch (Dave Ramchi)
INSERT INTO profiles (id, role, vorname, nachname, email, buffer_time_minutes, aktiv)
VALUES (
  '354daf10-bb83-4eec-a62a-8be4e45cab6b',
  'student',
  'Dave',
  'Ramchi',
  'd.ramchandani@bluewin.ch',
  15,
  true
)
ON CONFLICT (id) DO UPDATE SET
  vorname  = EXCLUDED.vorname,
  nachname = EXCLUDED.nachname,
  email    = EXCLUDED.email;

-- Test-Paket für Testschüler (entspricht bestehendem pakete-Eintrag)
INSERT INTO packages (student_id, type, lessons_total, lessons_used, price_per_lesson, active)
VALUES (
  '354daf10-bb83-4eec-a62a-8be4e45cab6b',
  'pack_10',
  10,
  0,
  80.00,
  true
)
ON CONFLICT DO NOTHING;

-- Standardmässige Verfügbarkeitsregeln (Mo–Fr, 08:00–20:00)
INSERT INTO time_block_rules (weekday, start_time, end_time, active)
VALUES
  (0, '08:00', '20:00', true),
  (1, '08:00', '20:00', true),
  (2, '08:00', '20:00', true),
  (3, '08:00', '20:00', true),
  (4, '08:00', '20:00', true)
ON CONFLICT DO NOTHING;
