import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");

  const admin = await createAdminClient();

  // Rechnung laden
  const { data: invoice, error } = await admin
    .from("invoices")
    .select("id, student_id, pdf_url, access_token, invoice_number, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !invoice) {
    return NextResponse.json({ error: "Rechnung nicht gefunden." }, { status: 404 });
  }

  // Auth: entweder eingeloggter Schüler (Eigentümer) oder gültiges access_token
  let authorized = false;

  if (token && invoice.access_token && token === invoice.access_token) {
    authorized = true;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.id === invoice.student_id) {
      authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 });
  }

  if (!invoice.pdf_url) {
    return NextResponse.json({ error: "Kein PDF verfügbar." }, { status: 404 });
  }

  // SPC-Fallback: pdf_url beginnt mit "spc:"
  if (invoice.pdf_url.startsWith("spc:")) {
    const spcData = invoice.pdf_url.slice(4);
    return new NextResponse(spcData, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="rechnung-${invoice.invoice_number}.txt"`,
      },
    });
  }

  // Supabase Storage: signierte URL holen oder direkt fetchen
  try {
    // pdf_url ist ein Storage-Pfad (z.B. "invoices/invoice-id.pdf")
    const { data: signedUrl } = await admin.storage
      .from("invoices")
      .createSignedUrl(invoice.pdf_url, 300); // 5 Minuten gültig

    if (!signedUrl?.signedUrl) {
      return NextResponse.json({ error: "PDF konnte nicht geladen werden." }, { status: 500 });
    }

    const pdfResponse = await fetch(signedUrl.signedUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: "PDF nicht abrufbar." }, { status: 502 });
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="rechnung-${invoice.invoice_number}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("PDF fetch error:", err);
    return NextResponse.json({ error: "PDF konnte nicht geladen werden." }, { status: 500 });
  }
}
