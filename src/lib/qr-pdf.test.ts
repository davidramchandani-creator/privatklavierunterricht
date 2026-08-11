import { describe, expect, it } from "vitest";
import { parseSchweizerAdresse } from "./qr-pdf";

/**
 * Die Adressen stammen aus dem echten Bestand. Wenn der Parser hier
 * durchfällt, bekommt ein Schüler eine Rechnung mit falscher oder fehlender
 * Adresse — und die kommt entweder nicht an oder lässt sich nicht zuordnen.
 */
describe("parseSchweizerAdresse", () => {
  it("zerlegt die üblichen Adressen aus dem Bestand", () => {
    expect(parseSchweizerAdresse("Sattleracherstrasse 19, 8413 Neftenbach")).toEqual({
      strasse: "Sattleracherstrasse",
      nummer: "19",
      plz: "8413",
      ort: "Neftenbach",
    });

    expect(parseSchweizerAdresse("Untere Breiten 4, 8413 Neftenbach")).toEqual({
      strasse: "Untere Breiten",
      nummer: "4",
      plz: "8413",
      ort: "Neftenbach",
    });
  });

  it("kommt mit Umlauten zurecht", () => {
    // „Chämiweg" und „Mühleweg" gibt es wirklich – ein Parser, der an
    // Umlauten scheitert, fällt erst beim echten Schüler auf.
    expect(parseSchweizerAdresse("Chämiweg 21, 8413 Neftenbach")).toEqual({
      strasse: "Chämiweg",
      nummer: "21",
      plz: "8413",
      ort: "Neftenbach",
    });

    expect(parseSchweizerAdresse("Mühleweg 20, 8413 Neftenbach")).toEqual({
      strasse: "Mühleweg",
      nummer: "20",
      plz: "8413",
      ort: "Neftenbach",
    });
  });

  it("behält Klammerzusätze im Ortsnamen", () => {
    // „Aesch (Neftenbach)" ist der amtliche Name – abschneiden wäre falsch.
    expect(parseSchweizerAdresse("Rebweg 4, 8412 Aesch (Neftenbach)")).toEqual({
      strasse: "Rebweg",
      nummer: "4",
      plz: "8412",
      ort: "Aesch (Neftenbach)",
    });

    expect(
      parseSchweizerAdresse("Bahnhofstrasse 10, 8412 Aesch bei Neftenbach")
    ).toEqual({
      strasse: "Bahnhofstrasse",
      nummer: "10",
      plz: "8412",
      ort: "Aesch bei Neftenbach",
    });
  });

  it("versteht Hausnummern mit Zusatz", () => {
    expect(parseSchweizerAdresse("Dorfstrasse 12a, 8422 Pfungen")?.nummer).toBe(
      "12a"
    );
    expect(parseSchweizerAdresse("Dorfstrasse 7-9, 8422 Pfungen")?.nummer).toBe(
      "7-9"
    );
  });

  it("nimmt bei mehreren Kommas den Teil vor dem Ort als Strasse", () => {
    expect(
      parseSchweizerAdresse("c/o Meier, Bahnhofstrasse 10, 8400 Winterthur")
    ).toEqual({
      strasse: "Bahnhofstrasse",
      nummer: "10",
      plz: "8400",
      ort: "Winterthur",
    });
  });

  it("erlaubt eine Strasse ohne Hausnummer", () => {
    // Es gibt Häuser ohne Nummer; der Standard lässt das Feld leer zu.
    expect(parseSchweizerAdresse("Im Rebberg, 8413 Neftenbach")).toEqual({
      strasse: "Im Rebberg",
      nummer: "",
      plz: "8413",
      ort: "Neftenbach",
    });
  });

  it("gibt null zurück, statt eine unvollständige Adresse zu raten", () => {
    // Dieser Fall steht so im echten Bestand: Strasse ohne PLZ und Ort.
    // Lieber gar keine Rechnung als eine, die nirgends ankommt.
    expect(parseSchweizerAdresse("Sattleracherstrasse 59")).toBeNull();
    expect(parseSchweizerAdresse("")).toBeNull();
    expect(parseSchweizerAdresse(null)).toBeNull();
    expect(parseSchweizerAdresse("   ")).toBeNull();
    // Keine vierstellige PLZ – vermutlich Ausland oder Tippfehler.
    expect(parseSchweizerAdresse("Hauptstrasse 1, Winterthur")).toBeNull();
    expect(parseSchweizerAdresse("Hauptstrasse 1, 80331 München")).toBeNull();
  });

  it("verträgt doppelte Leerzeichen und Zeilenumbrüche", () => {
    expect(
      parseSchweizerAdresse("  Dorfstrasse   5 ,\n 8422   Pfungen ")
    ).toEqual({
      strasse: "Dorfstrasse",
      nummer: "5",
      plz: "8422",
      ort: "Pfungen",
    });
  });
});
