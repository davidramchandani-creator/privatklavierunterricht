"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { geocode } from "@/lib/geocoding";
import { baueVorschau, naechsterPeriodenstart } from "@/lib/abo-server";
import { todayInZurich } from "@/lib/subscription";
import { redirectAddress } from "@/lib/email-sender";
import { TEST_SCHUELER, testEmail, testVerfuegbarkeit } from "@/lib/testdaten";
import { ladeFenster } from "@/lib/routing-server";
import type { Rhythmus } from "@/lib/rhythmus";

async function assertAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.role !== "admin") return { error: "Keine Berechtigung." };
  return null;
}

export type TestStand = {
  /** Umleitungsadresse, falls der Testmodus für Mails aktiv ist. */
  umleitung: string | null;
  anzahlTest: number;
  anzahlEcht: number;
  schueler: {
    id: string;
    name: string;
    adresse: string | null;
    hatKoordinaten: boolean;
    hatAbo: boolean;
    zeiten: number;
    termine: number;
  }[];
};

export async function testStand(): Promise<TestStand> {
  const verboten = await assertAdmin();
  if (verboten) {
    return { umleitung: null, anzahlTest: 0, anzahlEcht: 0, schueler: [] };
  }

  const admin = await createAdminClient();

  const { data: alle } = await admin
    .from("profiles")
    .select("id, vorname, nachname, adresse, lat, ist_test")
    .eq("role", "student");

  const test = (alle ?? []).filter((p) => p.ist_test);
  const ids = test.map((p) => p.id as string);

  const [{ data: pakete }, { data: verf }, { data: termine }] =
    ids.length > 0
      ? await Promise.all([
          admin
            .from("packages")
            .select("student_id")
            .eq("status", "active")
            .in("student_id", ids),
          admin
            .from("student_verfuegbarkeit")
            .select("student_id")
            .in("student_id", ids),
          admin
            .from("appointments")
            .select("student_id")
            .in("student_id", ids)
            .eq("status", "booked"),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const zaehle = (rows: { student_id: string }[] | null, id: string) =>
    (rows ?? []).filter((r) => r.student_id === id).length;

  return {
    umleitung: redirectAddress(),
    anzahlTest: test.length,
    anzahlEcht: (alle ?? []).length - test.length,
    schueler: test.map((p) => ({
      id: p.id as string,
      name: `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim(),
      adresse: (p.adresse as string) ?? null,
      hatKoordinaten: p.lat != null,
      hatAbo: zaehle(pakete as { student_id: string }[], p.id as string) > 0,
      zeiten: zaehle(verf as { student_id: string }[], p.id as string),
      termine: zaehle(termine as { student_id: string }[], p.id as string),
    })),
  };
}

/**
 * Legt das Abo eines Testschülers an – bewusst **ohne** Fixplatz.
 *
 * Genau das soll die Zuteilung ja finden. Bis vor Kurzem verbot eine Regel in
 * der Datenbank diesen Zustand („Fixplatz heisst, der Platz steht"), weshalb
 * das Anlegen stillschweigend fehlschlug und die Testschüler ohne Abo
 * dastanden.
 */
async function legeTestAboAn(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  userId: string,
  t: (typeof TEST_SCHUELER)[number],
  unterrichtstage: { wochentag: number; beginn: string; ende: string }[]
): Promise<string | null> {
  const periodeStart = naechsterPeriodenstart(todayInZurich());
  const vorschau = await baueVorschau(admin, {
    studentId: userId,
    variante: t.variante,
    rhythmus: t.rhythmus as Rhythmus,
    bookingMode: "fix",
    weekday:
      testVerfuegbarkeit(t, unterrichtstage)[0]?.wochentag ??
      unterrichtstage[0].wochentag,
    periodeStart,
  });

  const { error } = await admin.from("packages").insert({
    student_id: userId,
    type: t.variante === "halbjahr" ? "10er" : "20er",
    name: `Testabo ${t.variante}`,
    lessons_total: vorschau.lektionen,
    price_per_lesson: vorschau.preisProLektion,
    total_price: vorschau.gesamtpreis,
    payment_method: "qr",
    starts_at: new Date(`${periodeStart}T00:00:00.000Z`).toISOString(),
    expires_at: new Date(`${vorschau.periodeEnde}T23:59:59.000Z`).toISOString(),
    status: "active",
    billing_mode: "raten",
    term_months: vorschau.laufzeitMonate,
    auto_renew: false,
    deposit_amount: 0,
    instalment_count: vorschau.laufzeitMonate,
    instalment_amount: vorschau.monatsbetrag,
    rhythmus: t.rhythmus,
    booking_mode: "fix",
    flex_surcharge_percent: 0,
    abo_variante: t.variante,
    abo_lektionen: vorschau.lektionen,
    monatsbetrag: vorschau.monatsbetrag,
    periode_start: periodeStart,
    periode_ende: vorschau.periodeEnde,
  });

  return error ? error.message : null;
}

/**
 * Legt die Testschüler an: Konto, Profil, Adresse geokodiert, aktives Abo
 * und die Zeiten, die sie „angegeben" hätten.
 *
 * Die Zeiten kommen gleich mit, weil sonst der interessante Teil fehlt: ohne
 * sie liesse sich keine Zuteilung rechnen, und genau die will man ja sehen.
 * Wer den Mailweg testen will, löscht sie einzeln wieder oder nutzt die
 * Einzelanfrage.
 */
export async function testdatenAnlegen(): Promise<
  | {
      angelegt: number;
      aufgefrischt: number;
      nachgeliefert: number;
      ohneKoordinaten: string[];
      ohneAbo: string[];
      error: undefined;
    }
  | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  // Der Umleiter ist die einzige Sicherung zwischen einem Probelauf und den
  // echten Postfächern. Ohne ihn wird hier nichts angelegt – sonst startet
  // jemand später eine Runde und merkt es erst, wenn die Mails draussen sind.
  if (!redirectAddress()) {
    return {
      error:
        "EMAIL_REDIRECT_TO ist nicht gesetzt. Ohne Mail-Umleitung lege ich keine Testdaten an — ein Probelauf würde sonst echte Mails verschicken.",
    };
  }

  const admin = await createAdminClient();
  const ohneKoordinaten: string[] = [];
  let angelegt = 0;
  let aufgefrischt = 0;
  const ohneAbo: string[] = [];
  let nachgeliefert = 0;

  // Die Zeiten der Testschüler richten sich nach deinen echten
  // Unterrichtstagen. Fest verdrahtete Wochentage wären beim ersten Anlauf
  // schon falsch gewesen – dann fällt ein Testschüler mit „an keinem
  // Unterrichtstag verfügbar" heraus und man sucht den Fehler am falschen Ort.
  const unterrichtstage = await ladeFenster(admin);
  if (unterrichtstage.length === 0) {
    return {
      error:
        "Es sind keine Unterrichtszeiten hinterlegt. Trage sie zuerst unter Kalender → Verfügbarkeit ein.",
    };
  }

  for (let i = 0; i < TEST_SCHUELER.length; i++) {
    const t = TEST_SCHUELER[i];
    const email = testEmail(i);

    // Schon vorhanden? Dann nicht doppelt anlegen, aber die Zeiten
    // auffrischen. Ändern sich die Unterrichtstage, passen die alten Angaben
    // nicht mehr — und ein Testschüler, der an keinem Unterrichtstag kann,
    // sieht aus wie ein Fehler im Planer.
    const { data: da } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (da) {
      const id = da.id as string;
      await admin
        .from("student_verfuegbarkeit")
        .delete()
        .eq("student_id", id)
        .is("runde_id", null);
      await admin.from("student_verfuegbarkeit").insert(
        testVerfuegbarkeit(t, unterrichtstage).map((v) => ({
          student_id: id,
          runde_id: null,
          wochentag: v.wochentag,
          fruehestens: v.fruehestens,
          spaetestens: v.spaetestens,
          praeferenz: v.praeferenz,
        }))
      );
      // Fehlt das Abo, wird es nachgeliefert. Beim ersten Anlauf sind alle
      // fünf ohne Abo entstanden, weil der Insert an einer Regel scheiterte
      // und der Fehler verschluckt wurde.
      const { data: paket } = await admin
        .from("packages")
        .select("id")
        .eq("student_id", id)
        .eq("status", "active")
        .maybeSingle();
      if (!paket) {
        const fehler = await legeTestAboAn(admin, id, t, unterrichtstage);
        if (fehler) ohneAbo.push(`${t.vorname} ${t.nachname} (${fehler})`);
        else nachgeliefert++;
      }

      aufgefrischt++;
      continue;
    }

    const { data: userData, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { vorname: t.vorname, nachname: t.nachname },
      });
    if (createError || !userData?.user) continue;

    const userId = userData.user.id;
    const treffer = await geocode(t.adresse).catch(() => null);
    if (!treffer) ohneKoordinaten.push(`${t.vorname} ${t.nachname}`);

    const { error: profilFehler } = await admin.from("profiles").upsert(
      {
        id: userId,
        role: "student",
        vorname: t.vorname,
        nachname: t.nachname,
        email,
        adresse: t.adresse,
        aktiv: true,
        ist_test: true,
        payment_method: "qr",
        lat: treffer?.lat ?? null,
        lng: treffer?.lng ?? null,
      },
      { onConflict: "id" }
    );
    if (profilFehler) {
      await admin.auth.admin.deleteUser(userId).catch(() => null);
      continue;
    }

    const aboFehler = await legeTestAboAn(admin, userId, t, unterrichtstage);
    if (aboFehler) ohneAbo.push(`${t.vorname} ${t.nachname} (${aboFehler})`);

    // Dauerangabe (runde_id null) – eine Probelauf-Runde greift darauf zurück.
    await admin.from("student_verfuegbarkeit").insert(
      testVerfuegbarkeit(t, unterrichtstage).map((v) => ({
        student_id: userId,
        runde_id: null,
        wochentag: v.wochentag,
        fruehestens: v.fruehestens,
        spaetestens: v.spaetestens,
        praeferenz: v.praeferenz,
      }))
    );

    angelegt++;
  }

  revalidatePath("/admin/testmodus");
  revalidatePath("/admin/planung");
  revalidatePath("/admin/schueler");
  return {
    angelegt,
    aufgefrischt,
    nachgeliefert,
    ohneKoordinaten,
    ohneAbo,
    error: undefined,
  };
}

/**
 * Entfernt alle Testschüler restlos – samt Terminen, Abos, Rechnungen und
 * Anmeldekonto.
 *
 * Reihenfolge von innen nach aussen, damit keine Fremdschlüssel im Weg
 * stehen. Was per `on delete cascade` mitgeht, wird trotzdem aufgeführt: es
 * soll nachlesbar sein, was verschwindet, statt sich auf Datenbankregeln zu
 * verlassen, die jemand später ändert.
 */
export async function testdatenEntfernen(): Promise<
  { entfernt: number; error: undefined } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: test } = await admin
    .from("profiles")
    .select("id")
    .eq("ist_test", true);

  const ids = (test ?? []).map((p) => p.id as string);
  if (ids.length === 0) return { entfernt: 0, error: undefined };

  // Von innen nach aussen: erst was auf Termine und Pakete zeigt, dann diese
  // selbst, zuletzt das Profil.
  await admin.from("lesson_ausfaelle").delete().in("student_id", ids);
  await admin.from("invoices").delete().in("student_id", ids);
  await admin.from("package_instalments").delete().in("student_id", ids);
  await admin.from("package_extensions").delete().in("student_id", ids);
  await admin.from("appointments").delete().in("student_id", ids);
  await admin.from("student_verfuegbarkeit").delete().in("student_id", ids);
  await admin.from("planungs_antworten").delete().in("student_id", ids);
  await admin.from("planungsrunden").delete().in("nur_student_id", ids);
  await admin.from("packages").delete().in("student_id", ids);
  await admin.from("absences").delete().in("student_id", ids);
  await admin.from("profiles").delete().in("id", ids);

  for (const id of ids) {
    await admin.auth.admin.deleteUser(id).catch(() => null);
  }

  // Probelauf-Runden haben ohne Testschüler keinen Zweck mehr.
  await admin.from("planungsrunden").delete().eq("nur_test", true);

  revalidatePath("/admin/testmodus");
  revalidatePath("/admin/planung");
  revalidatePath("/admin/schueler");
  return { entfernt: ids.length, error: undefined };
}
