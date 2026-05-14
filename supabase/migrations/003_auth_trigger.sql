-- ============================================================
-- Auth Trigger: Rolle automatisch bei Signup setzen
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profile_roles (user_id, role)
  VALUES (NEW.id, 'schueler')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- View: Schüler mit aktivem Paket
-- ============================================================
CREATE OR REPLACE VIEW v_schueler_mit_paket AS
SELECT
  s.id,
  s.vorname,
  s.nachname,
  s.email,
  s.telefon,
  s.adresse,
  s.aktiv,
  s.erstellt_am,
  p.id              AS paket_id,
  p.typ             AS paket_typ,
  p.preis_pro_lektion,
  p.lektionen_gesamt,
  p.lektionen_genutzt,
  (p.lektionen_gesamt - p.lektionen_genutzt) AS verbleibende_lektionen,
  p.gueltig_bis,
  p.aktiv           AS paket_aktiv
FROM schueler s
LEFT JOIN pakete p ON p.schueler_id = s.id AND p.aktiv = true;

-- ============================================================
-- View: Nächste Termine
-- ============================================================
CREATE OR REPLACE VIEW v_naechste_termine AS
SELECT
  t.id,
  t.beginn,
  t.ende,
  t.status,
  t.notiz,
  s.vorname || ' ' || s.nachname AS schueler_name,
  s.email AS schueler_email
FROM termine t
JOIN schueler s ON s.id = t.schueler_id
WHERE t.beginn > now()
  AND t.status IN ('bestaetigt', 'angefragt')
ORDER BY t.beginn ASC;
