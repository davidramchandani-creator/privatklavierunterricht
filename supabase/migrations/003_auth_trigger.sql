-- ============================================================
-- Automatisch profile_roles Eintrag beim User-Signup erstellen
-- Neue Schüler bekommen standardmässig die Rolle 'schueler'
-- Admin-Rollen werden manuell gesetzt
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
-- View: Schüler mit aktuellem Paket (für Admin-Übersicht)
-- ============================================================
CREATE OR REPLACE VIEW v_schueler_mit_paket AS
SELECT
  s.id,
  s.name,
  s.email,
  s.telefon,
  s.adresse,
  s.distanz_km,
  s.wegkosten_aufschlag,
  s.zahlungsmethode,
  s.aktiv,
  s.erstellt_am,
  p.id AS paket_id,
  p.typ AS paket_typ,
  p.preis_pro_lektion,
  p.gesamtlektionen,
  p.gebrauchte_lektionen,
  (p.gesamtlektionen - p.gebrauchte_lektionen) AS verbleibende_lektionen,
  p.aktiviert_am,
  p.gueltig_bis,
  p.bezahlt AS paket_bezahlt,
  p.aktiv AS paket_aktiv
FROM schueler s
LEFT JOIN pakete p ON p.id = aktives_paket(s.id);

-- ============================================================
-- View: Nächste Termine (für Dashboard)
-- ============================================================
CREATE OR REPLACE VIEW v_naechste_termine AS
SELECT
  t.*,
  s.name AS schueler_name,
  s.email AS schueler_email
FROM termine t
JOIN schueler s ON s.id = t.schueler_id
WHERE t.datum > now()
  AND t.status IN ('angefragt', 'bestaetigt')
ORDER BY t.datum ASC;
