-- ============================================================
-- Migration 010: Re-seed for corrected tables
-- ============================================================

-- Re-seed packages with the student from migration 008 seed
-- 10er-Paket: 5 Monate gültig ab starts_at (Spec §3)
INSERT INTO packages (student_id, type, lessons_total, lessons_used, price_per_lesson, total_price, payment_method, status, starts_at, expires_at)
VALUES ('354daf10-bb83-4eec-a62a-8be4e45cab6b', '10er', 10, 0, 80.00, 800.00, 'twint', 'active', now(), now() + interval '5 months')
ON CONFLICT DO NOTHING;
