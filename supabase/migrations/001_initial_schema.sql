-- ============================================================
-- Privatklavierunterricht David – Initiales Datenbankschema
-- ============================================================

-- profile_roles
CREATE TABLE profile_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'schueler' CHECK (role IN ('admin','schueler')),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- schueler
CREATE TABLE schueler (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vorname         TEXT NOT NULL,
  nachname        TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  telefon         TEXT,
  adresse         TEXT,
  notizen         TEXT,
  aktiv           BOOLEAN NOT NULL DEFAULT true,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pakete
CREATE TABLE pakete (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schueler_id       UUID NOT NULL REFERENCES schueler(id) ON DELETE CASCADE,
  typ               TEXT NOT NULL CHECK (typ IN ('einzellektion','10er','20er')),
  lektionen_gesamt  SMALLINT NOT NULL,
  lektionen_genutzt SMALLINT NOT NULL DEFAULT 0,
  preis_pro_lektion NUMERIC(8,2) NOT NULL,
  aktiv             BOOLEAN NOT NULL DEFAULT true,
  gueltig_bis       TIMESTAMPTZ,
  erstellt_am       TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_lektionen CHECK (lektionen_genutzt <= lektionen_gesamt)
);

-- termine
CREATE TABLE termine (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schueler_id     UUID NOT NULL REFERENCES schueler(id) ON DELETE CASCADE,
  paket_id        UUID REFERENCES pakete(id) ON DELETE SET NULL,
  beginn          TIMESTAMPTZ NOT NULL,
  ende            TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'bestaetigt'
                  CHECK (status IN ('bestaetigt','storniert','abgeschlossen')),
  notiz           TEXT,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- zahlungen
CREATE TABLE zahlungen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schueler_id     UUID NOT NULL REFERENCES schueler(id) ON DELETE CASCADE,
  paket_id        UUID REFERENCES pakete(id) ON DELETE SET NULL,
  betrag          NUMERIC(8,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'offen'
                  CHECK (status IN ('offen','ausstehend','bezahlt')),
  methode         TEXT CHECK (methode IN ('twint','qr_rechnung','bar')),
  faellig_am      DATE,
  bezahlt_am      DATE,
  rechnung_nr     TEXT,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- bewertungen (max. eine pro Schüler)
CREATE TABLE bewertungen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schueler_id     UUID NOT NULL REFERENCES schueler(id) ON DELETE CASCADE UNIQUE,
  sterne          SMALLINT NOT NULL CHECK (sterne BETWEEN 1 AND 5),
  text            TEXT,
  anzeigen        BOOLEAN NOT NULL DEFAULT false,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- admin_verfuegbarkeit
CREATE TABLE admin_verfuegbarkeit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wochentag   SMALLINT NOT NULL CHECK (wochentag BETWEEN 0 AND 6),
  beginn_zeit TIME NOT NULL,
  ende_zeit   TIME NOT NULL,
  aktiv       BOOLEAN NOT NULL DEFAULT true,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- preise (globale Standardpreise)
CREATE TABLE preise (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typ               TEXT NOT NULL UNIQUE CHECK (typ IN ('einzellektion','10er','20er')),
  preis_pro_lektion NUMERIC(8,2) NOT NULL,
  aktiv             BOOLEAN NOT NULL DEFAULT true,
  erstellt_am       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO preise (typ, preis_pro_lektion) VALUES
  ('einzellektion', 105),
  ('10er', 90),
  ('20er', 85);

-- Indizes
CREATE INDEX idx_schueler_user_id     ON schueler(user_id);
CREATE INDEX idx_pakete_schueler_id   ON pakete(schueler_id);
CREATE INDEX idx_pakete_aktiv         ON pakete(aktiv);
CREATE INDEX idx_termine_schueler_id  ON termine(schueler_id);
CREATE INDEX idx_termine_beginn       ON termine(beginn);
CREATE INDEX idx_termine_status       ON termine(status);
CREATE INDEX idx_zahlungen_schueler   ON zahlungen(schueler_id);
CREATE INDEX idx_bewertungen_anzeigen ON bewertungen(anzeigen);
CREATE INDEX idx_profile_roles_user   ON profile_roles(user_id);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_aktualisiert_am()
RETURNS TRIGGER AS $$
BEGIN NEW.aktualisiert_am = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schueler_updated    BEFORE UPDATE ON schueler    FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();
CREATE TRIGGER pakete_updated      BEFORE UPDATE ON pakete      FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();
CREATE TRIGGER termine_updated     BEFORE UPDATE ON termine     FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();
CREATE TRIGGER zahlungen_updated   BEFORE UPDATE ON zahlungen   FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();
CREATE TRIGGER bewertungen_updated BEFORE UPDATE ON bewertungen FOR EACH ROW EXECUTE FUNCTION update_aktualisiert_am();
