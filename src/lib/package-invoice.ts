import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueEmail } from "@/lib/emails-outbox";
import { PACKAGE_LABELS } from "@/lib/packages";
import {
  buildInstalmentPlan,
  type InstalmentPlan,
  type SubscriptionType,
} from "@/lib/subscription";
import { buildPlanForRhythmus, type Rhythmus } from "@/lib/rhythmus";
import { zahlungsartFuer } from "@/lib/zahlungsart";

/** Zahlungsfrist für Paket-Rechnungen in Tagen (Spec: Zahlung innert 15 Tagen fällig). */
export const PACKAGE_INVOICE_DUE_DAYS = 15;

/** Zahlungsfrist für eine einzelne Rate ab Fälligkeitsdatum. */
export const INSTALMENT_DUE_DAYS = 10;

type PackageRow = {
  id: string;
  student_id: string;
  type: string;
  total_price: number | string | null;
  price_per_lesson: number | string | null;
  payment_method: string | null;
};

type ProfileRow = {
  vorname: string | null;
  nachname: string | null;
  adresse: string | null;
  email: string | null;
  payment_method: string | null;
};

function resolveMethod(pkg: PackageRow, profile: ProfileRow): "twint" | "qr" {
  // Nahm früher das Paket zuerst. Damit gewann eine Momentaufnahme vom Tag
  // des Anlegens gegen die Zahlungsart, die der Admin beim Schüler pflegt.
  return zahlungsartFuer(profile, pkg);
}

function studentNameOf(profile: ProfileRow): string {
  return `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || "Schüler";
}

/**
 * Legt eine Rechnung für ein Paket an und reiht die Zahlungsmail (TWINT/QR)
 * sofort in die Outbox ein. Gemeinsame Basis für Einmalzahlung, Anzahlung
 * und einzelne Raten.
 */
async function insertPackageInvoice(
  admin: SupabaseClient,
  pkg: PackageRow,
  profile: ProfileRow,
  opts: {
    amount: number;
    description: string;
    dueDate: Date;
    instalmentId?: string | null;
  }
): Promise<{ invoiceId: string } | { error: string }> {
  const method = resolveMethod(pkg, profile);
  const studentName = studentNameOf(profile);

  const { data: inv, error } = await admin
    .from("invoices")
    .insert({
      student_id: pkg.student_id,
      package_id: pkg.id,
      instalment_id: opts.instalmentId ?? null,
      amount: opts.amount,
      payer_name: studentName,
      payer_address: profile.adresse ?? null,
      status: "unpaid",
      method,
      lesson_date: null,
      due_date: opts.dueDate.toISOString(),
      description: opts.description,
    })
    .select("id, invoice_number")
    .maybeSingle();

  if (error || !inv) {
    // 23505 = unique_violation. Der partielle Unique-Index
    // `invoices_one_per_instalment` bzw. `invoices_one_active_per_appointment`
    // hat einen Doppelversand abgefangen: es gibt bereits eine Rechnung.
    if (error?.code === "23505") {
      return { error: "Für diese Position besteht bereits eine Rechnung." };
    }
    return { error: error?.message ?? "Rechnung konnte nicht erstellt werden." };
  }

  if (profile.email) {
    const payload = {
      to: profile.email,
      student_name: studentName,
      student_id: pkg.student_id,
      amount: opts.amount,
      invoice_number: inv.invoice_number,
      invoice_id: inv.id,
      package_id: pkg.id,
      description: opts.description,
      due_date: opts.dueDate.toISOString(),
    };
    const type = method === "qr" ? "qr_invoice" : "twint_payment_request";
    await enqueueEmail(admin, type, payload, new Date());
  }

  return { invoiceId: inv.id };
}

/**
 * Einmalzahlung: eine einzige Rechnung über den gesamten Paketpreis,
 * fällig innert 15 Tagen. Das Paket ist sofort buchbar.
 */
export async function createPackageInvoice(
  admin: SupabaseClient,
  pkg: PackageRow,
  profile: ProfileRow
): Promise<{ invoiceId: string } | { error: string }> {
  const amount = Number(pkg.total_price ?? Number(pkg.price_per_lesson ?? 0));
  const description = PACKAGE_LABELS[pkg.type] ?? pkg.type;
  const dueDate = new Date(
    Date.now() + PACKAGE_INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000
  );

  return insertPackageInvoice(admin, pkg, profile, {
    amount,
    description,
    dueDate,
  });
}

/** Beschriftung einer Rate für Rechnung und Portal. */
export function instalmentLabel(
  packageType: string,
  kind: string,
  sequence: number,
  instalmentCount: number
): string {
  const base = PACKAGE_LABELS[packageType] ?? packageType;
  return kind === "anzahlung"
    ? `${base}, Anzahlung`
    : `${base}, Rate ${sequence}/${instalmentCount}`;
}

/** Fälligkeitsdatum einer Rate: Stichtag + Zahlungsfrist, in Zürich mittags. */
export function instalmentDueDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(
    Date.UTC(y, m - 1, d, 10, 0, 0) + INSTALMENT_DUE_DAYS * 24 * 60 * 60 * 1000
  );
}

/**
 * Ratenkauf: legt den kompletten Ratenplan an und stellt sofort die
 * Anzahlung in Rechnung. Die Monatsraten werden später vom Tagesjob
 * fakturiert, jeweils am Stichtag.
 */
export async function createInstalmentSchedule(
  admin: SupabaseClient,
  pkg: PackageRow,
  profile: ProfileRow,
  opts: {
    type: SubscriptionType;
    totalPrice: number;
    startDate: string;
    /**
     * Muss übergeben werden, sobald das Paket einen Rhythmus hat. Der Plan
     * hängt davon ab (Raten folgen der Unterrichtsdauer), ohne den Rhythmus
     * entstünden hier andere Raten als in den Paketspalten stehen.
     */
    rhythmus?: Rhythmus;
  }
): Promise<{ plan: InstalmentPlan; invoiceId: string } | { error: string }> {
  const plan = opts.rhythmus
    ? buildPlanForRhythmus(
        opts.type,
        opts.totalPrice,
        opts.startDate,
        opts.rhythmus
      )
    : buildInstalmentPlan(opts.type, opts.totalPrice, opts.startDate);

  const { data: rows, error } = await admin
    .from("package_instalments")
    .insert(
      plan.entries.map((e) => ({
        package_id: pkg.id,
        student_id: pkg.student_id,
        sequence: e.sequence,
        kind: e.kind,
        amount: e.amount,
        due_date: e.dueDate,
        status: "open",
      }))
    )
    .select("id, sequence, kind, amount, due_date");

  if (error || !rows) {
    return { error: error?.message ?? "Ratenplan konnte nicht angelegt werden." };
  }

  const deposit = rows.find((r) => r.sequence === 0);
  if (!deposit) {
    return { error: "Anzahlung fehlt im Ratenplan." };
  }

  const result = await insertPackageInvoice(admin, pkg, profile, {
    amount: Number(deposit.amount),
    description: instalmentLabel(pkg.type, "anzahlung", 0, plan.instalmentCount),
    dueDate: instalmentDueDate(deposit.due_date as string),
    instalmentId: deposit.id,
  });

  if ("error" in result) return result;

  await admin
    .from("package_instalments")
    .update({ status: "invoiced", invoice_id: result.invoiceId })
    .eq("id", deposit.id);

  return { plan, invoiceId: result.invoiceId };
}

/**
 * Stellt eine einzelne fällige Rate in Rechnung. Idempotent: Raten, die
 * bereits eine Rechnung haben, werden übersprungen.
 */
export async function issueInstalmentInvoice(
  admin: SupabaseClient,
  instalment: {
    id: string;
    sequence: number;
    kind: string;
    amount: number | string;
    due_date: string;
    invoice_id: string | null;
  },
  pkg: PackageRow & { instalment_count: number | null },
  profile: ProfileRow
): Promise<{ invoiceId: string } | { skipped: true } | { error: string }> {
  if (instalment.invoice_id) return { skipped: true };

  const result = await insertPackageInvoice(admin, pkg, profile, {
    amount: Number(instalment.amount),
    description: instalmentLabel(
      pkg.type,
      instalment.kind,
      instalment.sequence,
      pkg.instalment_count ?? 0
    ),
    dueDate: instalmentDueDate(instalment.due_date),
    instalmentId: instalment.id,
  });

  if ("error" in result) return result;

  await admin
    .from("package_instalments")
    .update({ status: "invoiced", invoice_id: result.invoiceId })
    .eq("id", instalment.id);

  return result;
}
