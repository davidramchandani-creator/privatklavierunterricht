import { describe, expect, it } from "vitest";
import { zahlungsartFuer } from "./zahlungsart";

describe("zahlungsartFuer", () => {
  it("das Profil gewinnt gegen das Paket", () => {
    // Genau der Fall, der einer Schülerin eine QR-Rechnung gebracht hat,
    // obwohl bei ihr TWINT hinterlegt war: Das Paket trug noch das alte
    // „qr" vom Tag des Anlegens.
    expect(
      zahlungsartFuer({ payment_method: "twint" }, { payment_method: "qr" }),
    ).toBe("twint");
    expect(
      zahlungsartFuer({ payment_method: "qr" }, { payment_method: "twint" }),
    ).toBe("qr");
  });

  it("fällt aufs Paket zurück, wenn das Profil nichts sagt", () => {
    expect(zahlungsartFuer({ payment_method: null }, { payment_method: "qr" })).toBe("qr");
    expect(zahlungsartFuer(null, { payment_method: "qr" })).toBe("qr");
  });

  it("nimmt TWINT, wenn beide nichts sagen", () => {
    // TWINT und nicht QR: Ein TWINT-Link funktioniert immer, eine
    // QR-Rechnung braucht eine zerlegbare Adresse und ein erzeugtes PDF.
    expect(zahlungsartFuer(null, null)).toBe("twint");
    expect(zahlungsartFuer({ payment_method: null }, undefined)).toBe("twint");
  });

  it("ignoriert Werte, die keine Zahlungsart sind", () => {
    expect(
      zahlungsartFuer({ payment_method: "paypal" }, { payment_method: "qr" }),
    ).toBe("qr");
    expect(zahlungsartFuer({ payment_method: "" }, null)).toBe("twint");
  });
});
