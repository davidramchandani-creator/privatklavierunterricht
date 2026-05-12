-- ============================================================
-- Privatklavierunterricht David – Initiales Datenbankschema
-- ============================================================

-- Rollen-Enum
CREATE TYPE user_role AS ENUM ('admin', 'schueler');
CREATE TYPE paket_typ AS ENUM ('einzellektion', '10er', '20er');
CREATE TYPE termin_status AS ENUM (
  'angefragt',
  'bestaetigt',
  'abgesagt_schueler',
  'abgesagt_admin',
  'abgeschlossen'
);
CREATE TYPE zahlung_status AS ENUM ('ausstehend', 'bezahlt', 'storniert');
CREATE TYPE zahlung_methode AS ENUM ('twint', 'qr_rechnung', 'bar');
CREATE TYPE bewertung_status AS ENUM ('angefragt', 'abgegeben');
CREATE TYPE wochentag AS ENUM ('0','1','2','3','4','5','6');

-- ============================================================
-- Profil-Rollen (verknüpft mit Supabase Auth)
-- ============================================================
CREATE TABLE profile_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role NOT NULL DEFAULT 'schueler',
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================
-- Schüler
-- ============================================================
CREATE TABLE schueler (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name                   TEXT NOT NULL,
  email                  TEXT NOT NULL UNIQUE,
  telefon                TEXT,
  adresse                TEXT,
  -- Distanz in km vom Studio (wird einmal gespeichert)
  distanz_km             NUMERIC(6,2),
  wegkosten_aufschlag    NUMERIC(6,2) NOT NULL DEFAULT 0,
  weiterempfehlungscode  TEXT,
  zahlungsmethode        zahlung_methode NOT NULL DEFAULT 'twint',
  notizen                TEXT,
  aktiv                  BOOLEAN NOT NULL DEFAULT true,
  erstellt_am            TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Pakete
-- ============================================================
CREATE TABLE pakete (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schueler_id         UUID NOT NULL REFERENCES schueler(id) ON DELETE CASCADE,
  typ                 paket_typ NOT NULL,
  preis_pro_lektion   NUMERIC(8,2) NOT NULL,
  gesamtlektionen     SMALLINT NOT NULL,
  gebrauchte_lektionen SMALLINT NOT NULL DEFAULT 0,
  -- Gültigkeitsdauer: 10er=5 Monate, 20er=10 Monate
  aktiviert_am        TIMESTAMPTZ,
  gueltig_bis         TIMESTAMPTZ,
  aktiv               BOOLEAN NOT NULL DEFAULT true,
  bezahlt             BOOLEAN NOT NULL DEFAULT false,
  storniert           BOOLEAN NOT NULL DEFAULT false,
  erstellt_am         TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Nur ein aktives Paket pro Schüler gleichzeitig
  CONSTRAINT check_lektionen CHECK (gebrauchte_lektionen <= gesamtlektionen)
);

-- ============================================================
-- Termine
-- ============================================================
CREATE TABLE termine (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schueler_id      UUID NOT NULL REFERENCES schueler(id) ON DELETE CASCADE,
  paket_id         UUID REFERENCES pakete(id) ON DELETE SET NULL,
  -- Einzellektion ohne Paket
  ist_einzellektion BOOLEAN NOT NULL DEFAULT false,
  datum            TIMESTAMPTZ NOT NULL,
  dauer_minuten    SMALLINT NOT NULL DEFAULT 60,
  status           termin_status NOT NULL DEFAULT 'angefragt',
  preis            NUMERIC(8,2) NOT NULL DEFAULT 0,
  wegkosten        NUMERIC(8,2) NOT NULL DEFAULT 0,
  notizen          TEXT,
  -- Google Calendar Event ID für Sync
  google_event_id  TEXT,
  erstellt_am      TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Zahlungen
-- ============================================================
CREATE TABLE zahlungen (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schueler_id  UUID NOT NULL REFERENCES schueler(id) ON DELETE CASCADE,
  paket_id     UUID REFERENCES pakete(id) ON DELETE SET NULL,
  termin_id    UUID REFERENCES termine(id) ON DELETE SET NULL,
  betrag       NUMERIC(8,2) NOT NULL,
  methode      zahlung_methode NOT NULL,
  status       zahlung_status NOT NULL DEFAULT 'ausstehend',
  notizen      TEXT,
  erstellt_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  bezahlt_am   TIMESTAMPTZ,
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Bewertungen
-- ============================================================
CREATE TABLE bewertungen (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schueler_id   UUID NOT NULL REFERENCES schueler(id) ON DELETE CASCADE,
  sterne        SMALLINT NOT NULL CHECK (sterne BETWEEN 1 AND 5),
  text          TEXT,
  status        bewertung_status NOT NULL DEFAULT 'angefragt',
  angefragt_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  abgegeben_am  TIMESTAMPTZ,
  -- Admin kann entscheiden ob sichtbar
  anzeigen      BOOLEAN NOT NULL DEFAULT false,
  anonym        BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================
-- Admin-Verfügbarkeiten & Abwesenheiten
-- ============================================================
CREATE TABLE admin_verfuegbarkeit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Wochentag 0=So, 1=Mo, ..., 6=Sa (NULL wenn konkretes Datum)
  wochentag       SMALLINT CHECK (wochentag BETWEEN 0 AND 6),
  -- Konkretes Datum (NULL wenn wöchentlich)
  datum           DATE,
  von_uhrzeit     TIME NOT NULL,
  bis_uhrzeit     TIME NOT NULL,
  ist_abwesenheit BOOLEAN NOT NULL DEFAULT false,
  wiederholend    BOOLEAN NOT NULL DEFAULT true,
  notizen         TEXT,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_wochentag_oder_datum CHECK (
    (wochentag IS NOT NULL AND datum IS NULL) OR
    (wochentag IS NULL AND datum IS NOT NULL)
  )
);

-- ============================================================
-- Schüler-Ferien (zum Pausieren des Paket-Timers)
-- ============================================================
CREATE TABLE schueler_ferien (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schueler_id UUID NOT NULL REFERENCES schueler(id) ON DELETE CASCADE,
  von_datum   DATE NOT NULL,
  bis_datum   DATE NOT NULL,
  notizen     TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_datum CHECK (bis_datum >= von_datum)
);

-- ============================================================
-- Mail-Log (für Nachvollziehbarkeit)
-- ============================================================
CREATE TABLE mail_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schueler_id UUID REFERENCES schueler(id) ON DELETE SET NULL,
  typ         TEXT NOT NULL,
  empfaenger  TEXT NOT NULL,
  betreff     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'gesendet',
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Preise (Admin kann pro Schüler individuelle Preise setzen)
-- ============================================================
CREATE TABLE preise (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = globaler Standardpreis
  schueler_id           UUID REFERENCES schueler(id) ON DELETE CASCADE,
  paket_typ             paket_typ NOT NULL,
  preis_pro_lektion     NUMERIC(8,2) NOT NULL,
  gueltig_ab            TIMESTAMPTZ NOT NULL DEFAULT now(),
  erstellt_am           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schueler_id, paket_typ)
);

-- Globale Standardpreise einfügen
INSERT INTO preise (schueler_id, paket_typ, preis_pro_lektion) VALUES
  (NULL, 'einzellektion', 105),
  (NULL, '10er', 90),
  (NULL, '20er', 85);

-- ============================================================
-- Indizes für Performance
-- ============================================================
CREATE INDEX idx_schueler_user_id ON schueler(user_id);
CREATE INDEX idx_schueler_email ON schueler(email);
CREATE INDEX idx_pakete_schueler_id ON pakete(schueler_id);
CREATE INDEX idx_pakete_aktiv ON pakete(aktiv);
CREATE INDEX idx_termine_schueler_id ON termine(schueler_id);
CREATE INDEX idx_termine_datum ON termine(datum);
CREATE INDEX idx_termine_status ON termine(status);
CREATE INDEX idx_zahlungen_schueler_id ON zahlungen(schueler_id);
CREATE INDEX idx_bewertungen_anzeigen ON bewertungen(anzeigen);
CREATE INDEX idx_profile_roles_user_id ON profile_roles(user_id);

-- ============================================================
-- Updated-at Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_aktualisiert_am()
RETURNS TRIGGER AS $$
BEGIN
  NEW.aktualisiert_am = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schueler_updated
  BEFORE UPDATE ON schueler
  FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();

CREATE TRIGGER pakete_updated
  BEFORE UPDATE ON pakete
  FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();

CREATE TRIGGER termine_updated
  BEFORE UPDATE ON termine
  FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();

CREATE TRIGGER zahlungen_updated
  BEFORE UPDATE ON zahlungen
  FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();

-- ============================================================
-- Hilfsfunktion: Verbleibende Lektionen
-- ============================================================
CREATE OR REPLACE FUNCTION verbleibende_lektionen(p_paket_id UUID)
RETURNS SMALLINT AS $$
  SELECT gesamtlektionen - gebrauchte_lektionen
  FROM pakete
  WHERE id = p_paket_id;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- Hilfsfunktion: Aktives Paket eines Schülers
-- ============================================================
CREATE OR REPLACE FUNCTION aktives_paket(p_schueler_id UUID)
RETURNS UUID AS $$
  SELECT id FROM pakete
  WHERE schueler_id = p_schueler_id
    AND aktiv = true
    AND storniert = false
    AND (gueltig_bis IS NULL OR gueltig_bis > now())
    AND gebrauchte_lektionen < gesamtlektionen
  ORDER BY erstellt_am DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;
