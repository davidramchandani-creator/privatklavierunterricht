export type UserRole = "admin" | "schueler";

export type PaketTyp = "einzellektion" | "10er" | "20er";

export type TerminStatus =
  | "angefragt"
  | "bestaetigt"
  | "abgesagt_schueler"
  | "abgesagt_admin"
  | "abgeschlossen";

export type ZahlungStatus = "ausstehend" | "bezahlt" | "storniert";

export type ZahlungMethode = "twint" | "qr_rechnung" | "bar";

export type BewertungStatus = "angefragt" | "abgegeben";

export interface Schueler {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  telefon: string | null;
  adresse: string | null;
  weiterempfehlungscode: string | null;
  zahlungsmethode: ZahlungMethode;
  notizen: string | null;
  erstellt_am: string;
  aktiv: boolean;
}

export interface Paket {
  id: string;
  schueler_id: string;
  typ: PaketTyp;
  preis_pro_lektion: number;
  gesamtlektionen: number;
  gebrauchte_lektionen: number;
  gueltig_bis: string;
  aktiv: boolean;
  erstellt_am: string;
  aktiviert_am: string | null;
  bezahlt: boolean;
}

export interface Termin {
  id: string;
  schueler_id: string;
  paket_id: string | null;
  datum: string;
  dauer_minuten: number;
  status: TerminStatus;
  notizen: string | null;
  erstellt_am: string;
  ist_einzellektion: boolean;
  preis: number;
}

export interface Zahlung {
  id: string;
  schueler_id: string;
  paket_id: string | null;
  termin_id: string | null;
  betrag: number;
  methode: ZahlungMethode;
  status: ZahlungStatus;
  erstellt_am: string;
  bezahlt_am: string | null;
  notizen: string | null;
}

export interface Bewertung {
  id: string;
  schueler_id: string;
  sterne: number;
  text: string;
  status: BewertungStatus;
  angefragt_am: string;
  abgegeben_am: string | null;
  anzeigen: boolean;
}

export interface AdminVerfuegbarkeit {
  id: string;
  wochentag: number | null;
  datum: string | null;
  von_uhrzeit: string;
  bis_uhrzeit: string;
  ist_abwesenheit: boolean;
  wiederholend: boolean;
  notizen: string | null;
}

export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}
