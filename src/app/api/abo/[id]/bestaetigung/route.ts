// ============================================================
// Abo-Bestätigung als PDF ausliefern
//
// Zugang hat der Schüler selbst und der Admin. Kein Token, anders als bei den
// Rechnungen: Der Link steht in der Bestätigungsmail, und wer sie bekommt,
// hat auch ein Portal-Konto. Ein Token wäre ein zweiter Weg an der Anmeldung
// vorbei, der gepflegt und irgendwann auch zurückgezogen werden müsste.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { erzeugeAboBestaetigungPdf } from "@/lib/abo-pdf";
import { ladeBestaetigung } from "@/lib/umstellung-server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const admin = await createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select("student_id")
    .eq("id", id)
    .maybeSingle();

  if (!pkg) {
    return NextResponse.json({ error: "Abo nicht gefunden." }, { status: 404 });
  }

  if (pkg.student_id !== user.id) {
    const { data: profil } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profil?.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 });
    }
  }

  const daten = await ladeBestaetigung(admin, id);
  if (!daten) {
    return NextResponse.json(
      { error: "Zu diesem Abo gibt es keine Bestätigung." },
      { status: 404 }
    );
  }

  try {
    const pdf = await erzeugeAboBestaetigungPdf(daten);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="abo-bestaetigung.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[abo-pdf]", err);
    return NextResponse.json(
      { error: "Das PDF konnte nicht erzeugt werden." },
      { status: 500 }
    );
  }
}
