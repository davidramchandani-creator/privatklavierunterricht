import { describe, expect, it } from "vitest";
import {
  bookingLock,
  bookingLockReason,
  buildPlanSummary,
  daysBetween,
  dueLabel,
  formatDay,
  instalmentLabels,
  type InstalmentRow,
} from "./instalment-view";

const plan: InstalmentRow[] = [
  { id: "a", sequence: 0, kind: "anzahlung", amount: 175, due_date: "2026-08-07", status: "paid", invoice_id: "i1" },
  { id: "b", sequence: 1, kind: "rate", amount: 131.25, due_date: "2026-09-07", status: "paid", invoice_id: "i2" },
  { id: "c", sequence: 2, kind: "rate", amount: 131.25, due_date: "2026-10-07", status: "invoiced", invoice_id: "i3" },
  { id: "d", sequence: 3, kind: "rate", amount: 131.25, due_date: "2026-11-07", status: "open", invoice_id: null },
  { id: "e", sequence: 4, kind: "rate", amount: 131.25, due_date: "2026-12-07", status: "open", invoice_id: null },
];

describe("daysBetween", () => {
  it("zählt vorwärts und rückwärts", () => {
    expect(daysBetween("2026-09-28", "2026-10-07")).toBe(9);
    expect(daysBetween("2026-10-20", "2026-10-07")).toBe(-13);
    expect(daysBetween("2026-10-07", "2026-10-07")).toBe(0);
  });

  it("rechnet über Monats- und Jahresgrenzen", () => {
    expect(daysBetween("2026-12-28", "2027-01-04")).toBe(7);
  });
});

describe("instalmentLabels", () => {
  it("benennt Anzahlung und Raten", () => {
    expect(instalmentLabels({ kind: "anzahlung", sequence: 0 }, 4).label).toBe("Anzahlung");
    expect(instalmentLabels({ kind: "rate", sequence: 2 }, 4).label).toBe("Rate 2 von 4");
    expect(instalmentLabels({ kind: "rate", sequence: 2 }, 4).shortLabel).toBe("Rate 2/4");
  });
});

describe("buildPlanSummary, laufender Plan", () => {
  const s = buildPlanSummary(plan, "2026-09-28");

  it("zählt bezahlte Raten und Beträge", () => {
    expect(s.paidCount).toBe(2);
    expect(s.totalCount).toBe(5);
    expect(s.paidAmount).toBe(306.25);
    expect(s.total).toBe(700);
    expect(s.openAmount).toBe(393.75);
    expect(s.percentPaid).toBe(44);
  });

  it("markiert genau eine nächste Rate", () => {
    expect(s.entries.filter((e) => e.isNext)).toHaveLength(1);
    expect(s.next?.label).toBe("Rate 2 von 4");
    expect(s.next?.daysUntilDue).toBe(9);
  });

  it("unterscheidet fakturiert von noch nicht fällig", () => {
    expect(s.entries.map((e) => e.state)).toEqual([
      "bezahlt",
      "bezahlt",
      "offen",
      "geplant",
      "geplant",
    ]);
  });

  it("meldet keine Überfälligkeit", () => {
    expect(s.hasOverdue).toBe(false);
    expect(s.overdueAmount).toBe(0);
  });
});

describe("buildPlanSummary, überfällig", () => {
  const s = buildPlanSummary(plan, "2026-10-20");

  it("kippt eine fakturierte, abgelaufene Rate auf überfällig", () => {
    expect(s.entries[2].state).toBe("ueberfaellig");
    expect(s.overdueCount).toBe(1);
    expect(s.overdueAmount).toBe(131.25);
    expect(s.hasOverdue).toBe(true);
  });

  it("die überfällige Rate bleibt die nächste", () => {
    expect(s.next?.id).toBe("c");
    expect(s.next?.daysUntilDue).toBe(-13);
  });
});

describe("buildPlanSummary, Sonderfälle", () => {
  it("stornierte Raten zählen nicht mit", () => {
    const s = buildPlanSummary(
      [
        ...plan.slice(0, 2),
        { ...plan[2], status: "cancelled" },
        ...plan.slice(3),
      ],
      "2026-09-28"
    );
    expect(s.totalCount).toBe(4);
    expect(s.total).toBe(568.75);
    expect(s.next?.id).toBe("d");
  });

  it("vollständig bezahlt ergibt 100 % und keine nächste Rate", () => {
    const s = buildPlanSummary(
      plan.map((r) => ({ ...r, status: "paid" })),
      "2027-01-01"
    );
    expect(s.percentPaid).toBe(100);
    expect(s.openAmount).toBe(0);
    expect(s.next).toBeNull();
    expect(s.entries.some((e) => e.isNext)).toBe(false);
  });

  it("gemeldete Zahlung erscheint als in Prüfung", () => {
    const s = buildPlanSummary(
      [{ ...plan[2], status: "pending_confirmation" }],
      "2026-10-20"
    );
    expect(s.entries[0].state).toBe("in_pruefung");
    expect(s.hasOverdue).toBe(false);
  });

  it("sortiert unsortierte Eingaben nach Sequenz", () => {
    const s = buildPlanSummary([plan[3], plan[0], plan[2]], "2026-09-28");
    expect(s.entries.map((e) => e.sequence)).toEqual([0, 2, 3]);
  });

  it("kommt mit leerem Plan zurecht", () => {
    const s = buildPlanSummary([], "2026-09-28");
    expect(s.total).toBe(0);
    expect(s.percentPaid).toBe(0);
    expect(s.next).toBeNull();
  });
});

describe("dueLabel", () => {
  it("formuliert künftige Fälligkeiten", () => {
    expect(dueLabel(9, false)).toBe("fällig in 9 Tagen");
    expect(dueLabel(1, false)).toBe("morgen fällig");
    expect(dueLabel(0, false)).toBe("heute fällig");
  });

  it("formuliert Überfälligkeit", () => {
    expect(dueLabel(-13, true)).toBe("13 Tage überfällig");
    expect(dueLabel(-1, true)).toBe("1 Tag überfällig");
    expect(dueLabel(0, true)).toBe("heute fällig");
  });
});

describe("formatDay", () => {
  it("schreibt Schweizer Kurzdatum", () => {
    expect(formatDay("2026-10-07")).toBe("7. Okt. 2026");
    expect(formatDay("2026-03-31")).toBe("31. März 2026");
  });
});

describe("bookingLock, Buchungssperre", () => {
  const anzahlung = (status: string): InstalmentRow[] => [
    { id: "a", sequence: 0, kind: "anzahlung", amount: 250, due_date: "2026-08-01", status, invoice_id: null },
    { id: "b", sequence: 1, kind: "rate", amount: 187.5, due_date: "2026-09-01", status: "open", invoice_id: null },
  ];

  it("Einmalzahlung ist nie gesperrt", () => {
    expect(bookingLock("einmalig", anzahlung("open"), "2026-08-20").locked).toBe(false);
    expect(bookingLock(null, [], "2026-08-20").locked).toBe(false);
  });

  it("Ratenkauf ist gesperrt, solange die Anzahlung offen ist", () => {
    for (const status of ["open", "invoiced", "overdue"]) {
      expect(bookingLock("raten", anzahlung(status), "2026-08-20").locked).toBe(true);
    }
  });

  it("eine nur gemeldete Zahlung hebt die Sperre nicht auf", () => {
    const lock = bookingLock("raten", anzahlung("pending_confirmation"), "2026-08-20");
    expect(lock.locked).toBe(true);
    expect(lock.depositState).toBe("in_pruefung");
  });

  it("bezahlte Anzahlung gibt die Buchung frei", () => {
    const lock = bookingLock("raten", anzahlung("paid"), "2026-08-20");
    expect(lock.locked).toBe(false);
    expect(bookingLockReason(lock)).toBeNull();
  });

  it("offene Raten nach der Anzahlung sperren nicht", () => {
    const rows: InstalmentRow[] = [
      { id: "a", sequence: 0, kind: "anzahlung", amount: 250, due_date: "2026-08-01", status: "paid", invoice_id: null },
      { id: "b", sequence: 1, kind: "rate", amount: 187.5, due_date: "2026-08-05", status: "overdue", invoice_id: null },
    ];
    expect(bookingLock("raten", rows, "2026-08-20").locked).toBe(false);
  });

  it("Ratenkauf ohne hinterlegten Plan sperrt nicht", () => {
    expect(bookingLock("raten", [], "2026-08-20").locked).toBe(false);
  });

  it("nennt den Anzahlungsbetrag im Hinweis", () => {
    const lock = bookingLock("raten", anzahlung("open"), "2026-08-20");
    expect(lock.depositAmount).toBe(250);
    expect(bookingLockReason(lock)).toContain("CHF 250.00");
  });
});
