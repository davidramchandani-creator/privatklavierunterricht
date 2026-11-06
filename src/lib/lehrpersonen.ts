// ============================================================
// Lehrpersonen: Bezeichnungen, Prüfung, öffentliche Felder
//
// Siehe docs/Mehrere-Lehrpersonen-Plan.md. Grundsatz: Öffentlich ist nur,
// was David freigegeben hat, und nie Kontaktdaten oder Adressen.
// ============================================================

export type Unterrichtsort = "studio" | "zuhause" | "hausbesuch";
export type Altersgruppe = "kinder" | "jugendliche" | "erwachsene";

export const ORT_LABEL: Record<Unterrichtsort, string> = {
  studio: "Im Studio in Neftenbach",
  zuhause: "Bei sich zu Hause",
  hausbesuch: "Hausbesuche",
};

export const ALTER_LABEL: Record<Altersgruppe, string> = {
  kinder: "Kinder",
  jugendliche: "Jugendliche",
  erwachsene: "Erwachsene",
};

/**
 * Die einzigen Spalten, die je auf der Webseite landen dürfen.
 *
 * Adresse, Startpunkt, Lohn, Login und der unfreigegebene Entwurf fehlen
 * hier absichtlich. Ein Test prüft, dass die öffentliche Seite genau diese
 * Liste verwendet.
 */
export const OEFFENTLICHE_FELDER =
  "id, vorname, foto_url, kurztext, unterrichtsorte, region, altersgruppen, ist_inhaber, sortierung";

export type OeffentlicheLehrperson = {
  id: string;
  vorname: string;
  foto_url: string | null;
  kurztext: string | null;
  unterrichtsorte: Unterrichtsort[];
  region: string;
  altersgruppen: Altersgruppe[];
  ist_inhaber: boolean;
  sortierung: number;
};

/** „Bei sich zu Hause in der Region Winterthur“, ohne Adresse. */
export function orteText(l: Pick<OeffentlicheLehrperson, "unterrichtsorte" | "region">): string[] {
  return l.unterrichtsorte.map((o) =>
    o === "studio" ? ORT_LABEL.studio : `${ORT_LABEL[o]} (Region ${l.region})`
  );
}

export function alterText(gruppen: Altersgruppe[]): string | null {
  if (gruppen.length === 0) return null;
  return gruppen.map((g) => ALTER_LABEL[g]).join(", ");
}

/** Nur wer aktiv ist und einen freigegebenen Text hat, steht öffentlich. */
export function istOeffentlich(l: { status: string; kurztext: string | null }): boolean {
  return l.status === "aktiv" && !!l.kurztext && l.kurztext.trim().length > 0;
}

type Eingabe = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] };

function text(fd: Eingabe, name: string, max = 500): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

export type LehrpersonDaten = {
  vorname: string;
  nachname: string;
  unterrichtsorte: Unterrichtsort[];
  unterrichtsadresse: string | null;
  startpunkt_adresse: string | null;
  region: string;
  altersgruppen: Altersgruppe[];
  startdatum: string | null;
  lohn_pro_lektion: number | null;
  ferien_prozent: number;
  sortierung: number;
};

/** Prüft das Formular „Lehrperson anlegen/bearbeiten“. */
export function pruefeLehrperson(
  fd: Eingabe
): { ok: true; daten: LehrpersonDaten } | { ok: false; fehler: string } {
  const vorname = text(fd, "vorname", 100);
  const nachname = text(fd, "nachname", 100);
  if (!vorname || !nachname) return { ok: false, fehler: "Bitte Vor- und Nachname angeben." };

  const orte = fd
    .getAll("unterrichtsorte")
    .map(String)
    .filter((o): o is Unterrichtsort => o in ORT_LABEL);
  const alter = fd
    .getAll("altersgruppen")
    .map(String)
    .filter((a): a is Altersgruppe => a in ALTER_LABEL);

  const lohnRoh = text(fd, "lohn_pro_lektion");
  const lohn = lohnRoh === null ? null : Number(lohnRoh.replace(",", "."));
  if (lohn !== null && (!Number.isFinite(lohn) || lohn < 0 || lohn > 500)) {
    return { ok: false, fehler: "Der Lohn pro Lektion ist ungültig." };
  }
  const ferienRoh = text(fd, "ferien_prozent");
  const ferien = ferienRoh === null ? 8.33 : Number(ferienRoh.replace(",", "."));
  if (!Number.isFinite(ferien) || ferien < 0 || ferien > 20) {
    return { ok: false, fehler: "Die Ferienentschädigung ist ungültig (8.33 % oder 10.64 %)." };
  }
  const startdatum = text(fd, "startdatum");
  if (startdatum && !/^\d{4}-\d{2}-\d{2}$/.test(startdatum)) {
    return { ok: false, fehler: "Das Startdatum ist ungültig." };
  }

  return {
    ok: true,
    daten: {
      vorname,
      nachname,
      unterrichtsorte: [...new Set(orte)],
      unterrichtsadresse: text(fd, "unterrichtsadresse", 200),
      startpunkt_adresse: text(fd, "startpunkt_adresse", 200),
      region: text(fd, "region", 60) ?? "Winterthur",
      altersgruppen: [...new Set(alter)],
      startdatum,
      lohn_pro_lektion: lohn,
      ferien_prozent: Math.round(ferien * 100) / 100,
      sortierung: Math.round(Number(text(fd, "sortierung") ?? 0)) || 0,
    },
  };
}

/**
 * Lohn pro Lektion inklusive Ferienentschädigung aufgeteilt, wie er auf
 * der Lohnabrechnung stehen muss (David: CHF 50 inklusive).
 */
export function lohnAufteilung(brutto: number, ferienProzent: number): {
  grundlohn: number;
  ferien: number;
} {
  const grundlohn = Math.round((brutto / (1 + ferienProzent / 100)) * 100) / 100;
  return { grundlohn, ferien: Math.round((brutto - grundlohn) * 100) / 100 };
}
