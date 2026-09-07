// ============================================================
// Vom Routenplan zur Zuteilung, und was danach mit jedem Eintrag passiert
//
// Es gab zwei Planer. Der Routenplaner (routing.ts) bekam über Wochen alle
// Verbesserungen: Paarung über gemeinsame Slots, Selbstheilung,
// Wochenausgleich, Verdichtung. Die Zuteilung (zuteilung.ts) rechnete mit
// einem eigenen, älteren Verfahren und wusste von alldem nichts. Jede
// Korrektur hätte zweimal gemacht werden müssen, und wurde es nicht. Darum
// sah der Routenplan gut aus und die Zuteilung nicht.
//
// Jetzt gibt es einen Planer. Der Routenplan wird hier in Zuteilungs-
// Einträge übersetzt, und danach passiert alles von Hand: bearbeiten,
// verschieben, und pro Schüler einzeln freigeben. Nichts geht automatisch
// raus. Eine Freigabe löst eine Vertragsmail aus, und die will David sehen,
// bevor sie geht.
//
// Reine Funktionen. Datenbank in planung-server.ts und den Actions.
// ============================================================

import type { Routenplan } from "./routing";
import type { Zuteilung } from "./zuteilung";
import type { Rhythmus } from "./rhythmus";

/**
 * Wo ein Eintrag steht.
 *
 *   offen         Vorschlag, noch nichts passiert. Kann bearbeitet werden.
 *   reserviert    Der Platz ist für diese Person geblockt, aber es ging
 *                 nichts raus: kein Abo, keine Serie, keine Mail. Für
 *                 Leute, die noch kein Abo haben (Probelektion steht aus),
 *                 deren Platz aber nicht an jemand anderen gehen soll.
 *   freigegeben   Abo, Serie und Mail sind raus. Endgültig.
 */
export type ZuteilungStatus = "offen" | "reserviert" | "freigegeben";

/**
 * Was beim Freigeben passiert. Wird beim Laden aus der Datenbank bestimmt,
 * nicht gespeichert, damit es immer den aktuellen Stand zeigt: Wer heute
 * kein Abo hat, kann morgen eines haben.
 */
export type FreigabeArt =
  | "umstellung" // Abo anlegen, Serie buchen, Vertragsmail
  | "abo" // bestehendes Abo: Fixplatz setzen, Serie buchen, Mail
  | "extern" // Vereinbarung: Fixplatz, Serie, keine Mail
  | "ohne_abo"; // nichts anlegen, nur reservieren

export type ZuteilungEintrag = Zuteilung & {
  status: ZuteilungStatus;
  freigegebenAm: string | null;
  rhythmus: Rhythmus;
};

/** Ein Eintrag aus einem älteren Plan ohne die neuen Felder. */
export function normalisiere(z: Zuteilung & Partial<ZuteilungEintrag>): ZuteilungEintrag {
  return {
    ...z,
    status: z.status ?? "offen",
    freigegebenAm: z.freigegebenAm ?? null,
    rhythmus: z.rhythmus ?? (z.paritaet === null ? "woechentlich" : "zweiwoechentlich"),
  };
}

/**
 * Übersetzt den Routenplan in Zuteilungs-Einträge.
 *
 * Eine Position mit zwei verschiedenen Schülern (geteilter Platz) ergibt
 * zwei Einträge mit derselben Uhrzeit und verschiedener Parität. Eine
 * Position mit demselben Schüler in beiden Wochen ergibt einen Eintrag ohne
 * Parität. Eine halb leere Position ergibt einen Eintrag mit Parität, die
 * andere Hälfte bleibt frei.
 */
export function routenplanZuZuteilungen(plan: Routenplan): ZuteilungEintrag[] {
  const raus: ZuteilungEintrag[] = [];

  for (const tag of plan.tage) {
    for (const p of tag.positionen) {
      const g = p.geradeWoche;
      const u = p.ungeradeWoche;

      if (g && u && g.id === u.id) {
        raus.push({
          schuelerId: g.id,
          name: g.name,
          wochentag: tag.wochentag,
          beginn: p.beginn,
          paritaet: null,
          praeferenz: 2,
          anfahrtSekunden: p.anfahrtSekunden,
          unveraendert: false,
          status: "offen",
          freigegebenAm: null,
          rhythmus: "woechentlich",
        });
        continue;
      }

      if (g) {
        raus.push({
          schuelerId: g.id,
          name: g.name,
          wochentag: tag.wochentag,
          beginn: p.beginn,
          paritaet: 0,
          praeferenz: 2,
          anfahrtSekunden: p.anfahrtSekunden,
          unveraendert: false,
          status: "offen",
          freigegebenAm: null,
          rhythmus: "zweiwoechentlich",
        });
      }
      if (u) {
        raus.push({
          schuelerId: u.id,
          name: u.name,
          wochentag: tag.wochentag,
          beginn: p.beginn,
          paritaet: 1,
          praeferenz: 2,
          anfahrtSekunden: p.anfahrtSekunden,
          unveraendert: false,
          status: "offen",
          freigegebenAm: null,
          rhythmus: "zweiwoechentlich",
        });
      }
    }
  }

  return raus;
}

const minuten = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Überschneiden sich zwei Einträge?
 *
 * Zwei Termine kollidieren nur, wenn sie in derselben Woche stattfinden
 * können: Wöchentlich kollidiert mit allem am selben Tag, gerade mit gerade,
 * ungerade mit ungerade. Gerade und ungerade zur selben Uhrzeit ist kein
 * Konflikt, sondern der geteilte Platz, um den es überhaupt geht.
 */
export function ueberschneidet(
  a: Pick<Zuteilung, "wochentag" | "beginn" | "paritaet">,
  b: Pick<Zuteilung, "wochentag" | "beginn" | "paritaet">,
  lektionMinuten = 45,
  pufferMinuten = 0
): boolean {
  if (a.wochentag !== b.wochentag) return false;
  if (a.paritaet !== null && b.paritaet !== null && a.paritaet !== b.paritaet) {
    return false;
  }
  const aVon = minuten(a.beginn);
  const aBis = aVon + lektionMinuten + pufferMinuten;
  const bVon = minuten(b.beginn);
  const bBis = bVon + lektionMinuten + pufferMinuten;
  return aVon < bBis && bVon < aBis;
}

/**
 * Prüft, ob ein geänderter Eintrag mit den übrigen kollidiert.
 *
 * Gibt den Namen des ersten Betroffenen zurück, damit die Meldung sagt, mit
 * **wem** es sich beisst, nicht bloss dass es sich beisst.
 */
export function findeKonflikt(
  geaendert: Pick<Zuteilung, "schuelerId" | "wochentag" | "beginn" | "paritaet">,
  uebrige: ZuteilungEintrag[],
  pufferMinuten: number
): string | null {
  for (const z of uebrige) {
    if (z.schuelerId === geaendert.schuelerId) continue;
    if (ueberschneidet(geaendert, z, 45, pufferMinuten)) return z.name;
  }
  return null;
}

/**
 * Ist ein Eintrag noch änderbar?
 *
 * Nach der Freigabe nicht mehr: Dann existieren Abo, Termine und eine Mail
 * mit genau diesem Termin. Ändern hiesse, den Vertrag zu ändern, und das
 * ist ein anderer Vorgang mit anderer Mail.
 */
export function istAenderbar(z: ZuteilungEintrag): boolean {
  return z.status !== "freigegeben";
}
