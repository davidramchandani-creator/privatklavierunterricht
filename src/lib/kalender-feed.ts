// ============================================================
// Abonnierbarer Kalender (iCalendar)
//
// Kein .ics zum Herunterladen, sondern ein Feed, den Apple, Google und
// Outlook regelmässig neu holen. Der Unterschied ist der Punkt: Eine
// heruntergeladene Datei ist am Tag nach der ersten Verschiebung falsch,
// und niemand lädt sie neu. Ein Abo zieht Verschiebung und Storno von
// selbst nach.
//
// Zwei Sichten aus demselben Bauplan:
//
//   Schüler   nur die eigenen Lektionen, Titel „Klavierunterricht", Ort
//             die eigene Adresse. Keine anderen Namen.
//   Admin     alle Lektionen, Titel mit Schülername, Ort die Adresse des
//             Schülers, damit das Handy direkt in die Navigation springt.
//
// Reine Funktionen. Datenbank in der Route.
// ============================================================

export type FeedTermin = {
  id: string;
  /** ISO, UTC. */
  beginn: string;
  /** ISO, UTC. */
  ende: string;
  status: string;
  name: string;
  adresse: string | null;
  /** Nur im Admin-Feed: Hausbesuch oder kommt der Schüler? */
  hausbesuch?: boolean;
};

export type FeedSicht = "schueler" | "admin";

const CRLF = "\r\n";

/** ISO → iCalendar-Zeitstempel in UTC, z. B. 20260914T151500Z. */
export function icsZeit(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Text für ein iCalendar-Feld.
 *
 * Kommas, Strichpunkte und Backslashes haben in iCalendar Bedeutung; ein
 * „Sattleracherstrasse 59, 8413 Neftenbach" ohne Maskierung zerreisst die
 * Ortsangabe in zwei Felder. Zeilenumbrüche werden zu `\n`.
 */
export function icsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Zeilen über 75 Byte falten, wie der Standard es verlangt.
 *
 * Apple ist da streng: Eine überlange DESCRIPTION-Zeile führt nicht zu
 * einem Fehler, sondern zu einem stillschweigend leeren Kalender. Das
 * findet man nicht, ohne den Standard zu kennen.
 */
export function falte(zeile: string): string {
  const bytes = Buffer.from(zeile, "utf8");
  if (bytes.length <= 75) return zeile;
  const teile: string[] = [];
  let rest = zeile;
  // Die erste Zeile darf 75 Byte tragen. Jede Fortsetzung beginnt mit
  // einem Leerzeichen, das mitzählt: dort bleiben 74 Byte Nutzlast. Die
  // erste Fassung schnitt überall bei 75 und lieferte 76-Byte-Zeilen; der
  // Test hat es gefangen, Apple hätte einen leeren Kalender gezeigt.
  //
  // Beim Schneiden nie mitten in ein Mehrbyte-Zeichen (ä, ö, ü).
  let budget = 75;
  while (Buffer.from(rest, "utf8").length > budget) {
    let n = budget;
    while (Buffer.from(rest.slice(0, n), "utf8").length > budget) n--;
    teile.push(rest.slice(0, n));
    rest = rest.slice(n);
    budget = 74;
  }
  teile.push(rest);
  return teile
    .map((t, i) => (i === 0 ? t : " " + t))
    .join(CRLF);
}

/**
 * Baut den Feed.
 *
 * `stempel` ist die Zeit der Erzeugung (für DTSTAMP). Als Parameter, damit
 * Tests denselben Feed zweimal erzeugen und vergleichen können.
 */
export function baueFeed(
  termine: FeedTermin[],
  sicht: FeedSicht,
  stempel: Date = new Date()
): string {
  const zeilen: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//privatklavierunterricht.ch//Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    // Der Name, den die Kalender-App anzeigt. Ohne ihn heisst der Kalender
    // in Apple „Unbenannt" oder trägt die URL als Namen.
    `X-WR-CALNAME:${icsText(sicht === "admin" ? "Klavierunterricht (alle)" : "Klavierunterricht")}`,
    "X-WR-TIMEZONE:Europe/Zurich",
    // Wie oft die App nachschauen soll. Apple hält sich daran, Google
    // ignoriert es und holt in eigenem Takt. Schadet nicht.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  const dtstamp = icsZeit(stempel.toISOString());

  for (const t of termine) {
    // Stornierte Termine erscheinen mit STATUS:CANCELLED statt zu fehlen.
    // Fehlt ein Termin einfach, verschwindet er aus dem Abo, und der
    // Schüler weiss nicht, ob abgesagt oder verschoben. Durchgestrichen
    // ist ehrlicher.
    const abgesagt = t.status === "cancelled";

    const titel =
      sicht === "admin"
        ? `${t.hausbesuch === false ? "Bei mir: " : ""}${t.name}`
        : "Klavierunterricht";

    zeilen.push(
      "BEGIN:VEVENT",
      // UID stabil je Termin. Daran erkennt die App beim nächsten Abruf,
      // dass es derselbe Termin ist, nur verschoben — statt einen zweiten
      // daneben zu legen.
      `UID:${t.id}@privatklavierunterricht.ch`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${icsZeit(t.beginn)}`,
      `DTEND:${icsZeit(t.ende)}`,
      `SUMMARY:${icsText(abgesagt ? `Abgesagt: ${titel}` : titel)}`,
      `STATUS:${abgesagt ? "CANCELLED" : "CONFIRMED"}`
    );

    if (t.adresse) zeilen.push(`LOCATION:${icsText(t.adresse)}`);

    if (sicht === "schueler" && !abgesagt) {
      zeilen.push(
        "DESCRIPTION:" +
          icsText(
            "Absagen oder verschieben bis 24 Stunden vorher im Portal:\nhttps://privatklavierunterricht.ch/schueler/portal"
          )
      );
      // Erinnerung am Vorabend und eine Stunde vorher. Die Termin-
      // erinnerung per Mail gibt es weiterhin; das hier ist die, die auf
      // dem Handy klingelt.
      zeilen.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:Morgen Klavierunterricht",
        "TRIGGER:-P1D",
        "END:VALARM",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:In einer Stunde Klavierunterricht",
        "TRIGGER:-PT1H",
        "END:VALARM"
      );
    }

    if (sicht === "admin" && !abgesagt) {
      zeilen.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsText(`Gleich: ${t.name}`)}`,
        "TRIGGER:-PT30M",
        "END:VALARM"
      );
    }

    zeilen.push("END:VEVENT");
  }

  zeilen.push("END:VCALENDAR");
  return zeilen.map(falte).join(CRLF) + CRLF;
}

/**
 * Ein neuer Token: 32 Byte Zufall, als URL-taugliche Zeichen.
 *
 * Lang genug, dass Raten aussichtslos ist, kurz genug, dass er in einer
 * Adresse nicht abschreckt.
 */
export function neuerToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Wie weit der Feed zurück- und vorausschaut. */
export const FEED_RUECKBLICK_TAGE = 60;
export const FEED_VORSCHAU_TAGE = 400;
