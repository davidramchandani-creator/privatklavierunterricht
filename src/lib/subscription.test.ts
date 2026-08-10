import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildInstalmentPlan,
  cancellationDeadline,
  isCancellable,
  planTotal,
  roundRappen,
  SUBSCRIPTION_TERM_MONTHS,
} from "./subscription";

describe("roundRappen", () => {
  it("rundet auf 5 Rappen", () => {
    expect(roundRappen(121.875)).toBe(121.9);
    expect(roundRappen(131.25)).toBe(131.25);
    expect(roundRappen(0.024)).toBe(0);
    expect(roundRappen(0.026)).toBe(0.05);
  });
});

describe("addMonths", () => {
  it("verschiebt normale Daten", () => {
    expect(addMonths("2026-08-07", 1)).toBe("2026-09-07");
    expect(addMonths("2026-08-07", 8)).toBe("2027-04-07");
  });

  it("klemmt auf das Monatsende statt in den Folgemonat zu rutschen", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-31", 2)).toBe("2027-02-28");
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("behandelt Schaltjahre korrekt", () => {
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
  });
});

describe("buildInstalmentPlan – 10er (CHF 700)", () => {
  const plan = buildInstalmentPlan("10er", 700, "2026-08-07");

  it("hat 4 Monate Laufzeit und 4 Raten", () => {
    expect(plan.termMonths).toBe(4);
    expect(plan.instalmentCount).toBe(4);
    expect(SUBSCRIPTION_TERM_MONTHS["10er"]).toBe(4);
  });

  it("verlangt 25 % Anzahlung", () => {
    expect(plan.depositAmount).toBe(175);
  });

  it("teilt den Rest in 4 gleiche Raten", () => {
    expect(plan.instalmentAmount).toBe(131.25);
    const raten = plan.entries.filter((e) => e.kind === "rate");
    expect(raten.map((e) => e.amount)).toEqual([131.25, 131.25, 131.25, 131.25]);
  });

  it("setzt die Fälligkeiten auf den Monatstag", () => {
    expect(plan.entries.map((e) => e.dueDate)).toEqual([
      "2026-08-07",
      "2026-09-07",
      "2026-10-07",
      "2026-11-07",
      "2026-12-07",
    ]);
  });

  it("Anzahlung ist sofort fällig", () => {
    expect(plan.entries[0].kind).toBe("anzahlung");
    expect(plan.entries[0].sequence).toBe(0);
    expect(plan.entries[0].dueDate).toBe("2026-08-07");
  });

  it("Summe entspricht exakt dem Gesamtpreis", () => {
    expect(planTotal(plan)).toBe(700);
  });

  it("letzte Rate fällt mit dem Ablauf zusammen", () => {
    expect(plan.expiresOn).toBe("2026-12-07");
    expect(plan.entries.at(-1)!.dueDate).toBe(plan.expiresOn);
  });
});

describe("buildInstalmentPlan – 20er (CHF 1300)", () => {
  const plan = buildInstalmentPlan("20er", 1300, "2026-08-07");

  it("hat 8 Monate Laufzeit und 8 Raten", () => {
    expect(plan.termMonths).toBe(8);
    expect(plan.instalmentCount).toBe(8);
  });

  it("verlangt 25 % Anzahlung", () => {
    expect(plan.depositAmount).toBe(325);
  });

  it("die letzte Rate nimmt den Rundungsrest auf", () => {
    const raten = plan.entries.filter((e) => e.kind === "rate");
    expect(raten.slice(0, 7).map((e) => e.amount)).toEqual([
      121.9, 121.9, 121.9, 121.9, 121.9, 121.9, 121.9,
    ]);
    expect(raten.at(-1)!.amount).toBe(121.7);
  });

  it("Summe entspricht exakt dem Gesamtpreis", () => {
    expect(planTotal(plan)).toBe(1300);
  });

  it("läuft nach 8 Monaten ab", () => {
    expect(plan.expiresOn).toBe("2027-04-07");
  });
});

describe("buildInstalmentPlan – Rundungsrobustheit", () => {
  it("trifft die Summe auch bei krummen Preisen", () => {
    for (const preis of [733.33, 999.99, 1234.56, 87.4, 1]) {
      for (const typ of ["10er", "20er"] as const) {
        const plan = buildInstalmentPlan(typ, preis, "2026-08-07");
        expect(planTotal(plan)).toBe(roundRappen(preis));
      }
    }
  });

  it("erzeugt nie negative Raten", () => {
    const plan = buildInstalmentPlan("20er", 1, "2026-08-07");
    for (const e of plan.entries) {
      expect(e.amount).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Kündigung", () => {
  it("Frist liegt 14 Tage vor Ablauf", () => {
    expect(cancellationDeadline("2026-12-07")).toBe("2026-11-23");
    expect(cancellationDeadline("2027-04-07")).toBe("2027-03-24");
  });

  it("Frist über einen Monatswechsel hinweg", () => {
    expect(cancellationDeadline("2026-03-05")).toBe("2026-02-19");
  });

  it("kündbar bis und mit Stichtag", () => {
    expect(isCancellable("2026-12-07", "2026-11-23")).toBe(true);
    expect(isCancellable("2026-12-07", "2026-11-24")).toBe(false);
    expect(isCancellable("2026-12-07", "2026-08-07")).toBe(true);
  });
});
