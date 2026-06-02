import { describe, it, expect } from "vitest";
import {
  cancellationSingleLessonPrice,
  computeCancellationSettlement,
  canCancelPackage,
  type Package,
} from "./packages";

function makePackage(overrides: Partial<Package> = {}): Package {
  return {
    id: "p1",
    student_id: "s1",
    type: "10er",
    lessons_total: 10,
    lessons_used: 0,
    name: null,
    price_per_lesson: 70,
    total_price: 700,
    payment_method: null,
    starts_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    status: "active",
    paused: false,
    pause_remaining_seconds: null,
    paused_at: null,
    erstellt_am: new Date().toISOString(),
    ...overrides,
  };
}

describe("cancellationSingleLessonPrice", () => {
  it("70 + max(0, preis - 60)", () => {
    expect(cancellationSingleLessonPrice(70)).toBe(80); // 70 + 10
    expect(cancellationSingleLessonPrice(65)).toBe(75); // 70 + 5
    expect(cancellationSingleLessonPrice(60)).toBe(70); // 70 + 0
    expect(cancellationSingleLessonPrice(50)).toBe(70); // 70 + max(0,-10)=70
  });
});

describe("computeCancellationSettlement", () => {
  it("Rückerstattung bei 2 genutzten Lektionen (10er @70)", () => {
    const pkg = makePackage({ price_per_lesson: 70, total_price: 700, lessons_total: 10 });
    const s = computeCancellationSettlement(pkg, 2);
    expect(s.singleLessonPrice).toBe(80);
    expect(s.usedCost).toBe(160); // 2 × 80
    expect(s.paidTotal).toBe(700);
    expect(s.refund).toBe(540); // 700 - 160
    expect(s.owed).toBe(0);
  });

  it("Nachzahlung möglich, wenn genutzte Lektionen teurer als Paketpreis", () => {
    const pkg = makePackage({ price_per_lesson: 70, total_price: 100, lessons_total: 10 });
    const s = computeCancellationSettlement(pkg, 2);
    expect(s.usedCost).toBe(160);
    expect(s.refund).toBe(0);
    expect(s.owed).toBe(60); // 160 - 100
  });

  it("fällt auf lessons_total × preis zurück, wenn total_price fehlt", () => {
    const pkg = makePackage({ price_per_lesson: 65, total_price: null, lessons_total: 10 });
    const s = computeCancellationSettlement(pkg, 1);
    expect(s.paidTotal).toBe(650);
    expect(s.singleLessonPrice).toBe(75);
    expect(s.refund).toBe(575);
  });
});

describe("canCancelPackage", () => {
  it("erlaubt bis einschliesslich 3 genutzte Lektionen", () => {
    const pkg = makePackage();
    expect(canCancelPackage(pkg, 0)).toBe(true);
    expect(canCancelPackage(pkg, 3)).toBe(true);
    expect(canCancelPackage(pkg, 4)).toBe(false);
  });

  it("verbietet bereits stornierte Pakete", () => {
    const pkg = makePackage({ status: "cancelled" });
    expect(canCancelPackage(pkg, 0)).toBe(false);
  });

  it("erlaubt pausierte Pakete", () => {
    const pkg = makePackage({ paused: true, pause_remaining_seconds: 1000 });
    expect(canCancelPackage(pkg, 1)).toBe(true);
  });

  it("verbietet null-Paket", () => {
    expect(canCancelPackage(null, 0)).toBe(false);
  });
});
