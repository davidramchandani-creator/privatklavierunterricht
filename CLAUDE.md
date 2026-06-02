# Migrations-Spezifikation: privatklavierunterricht.ch (WordPress → Next.js / Supabase / Vercel / Resend)

> **Für Claude Code.** Dies ist die vollständige fachliche Spezifikation des bestehenden Systems. Es existiert heute als WordPress-Seite, gebaut aus vielen Code-Snippets. Ziel ist die Migration auf einen sauberen, modernen Stack. Baue **inkrementell** und halte dich an die unten beschriebenen Geschäftsregeln – diese sind im Live-Betrieb erprobt und dürfen nicht „vereinfacht" werden.

---

## 0. Bevor du irgendetwas baust

1. **Inspiziere zuerst das bestehende Repo.** Vieles ist laut Spezifikation bereits angelegt (Next.js, Tailwind, Supabase-Client, Vercel-Deploy, Swiss-QR-Logik, Google-Calendar-One-Way-Sync). Liste auf, was schon existiert, bevor du Neues schreibst. Doppelarbeit vermeiden.
2. **Frage nichts, was du im Repo nachschauen kannst.** Frage nur bei echten fachlichen Unklarheiten (siehe „Offene Punkte" am Ende).
3. Arbeite **Meilenstein für Meilenstein** (Abschnitt 14). Nicht alles auf einmal. Nach jedem Meilenstein: Build grün, kurz zusammenfassen, dann weiter.
4. Schreibe alles in **Deutsch** (UI-Texte, Mails, Kommentare wo sinnvoll). Du-Form, freundlich, unkompliziert.

---

## 1. Ziel-Stack & Konventionen

- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **DB & Auth:** Supabase (Postgres, Supabase Auth, Row Level Security)
- **Hosting:** Vercel
- **E-Mail:** Resend
- **Versionierung:** GitHub
- **Schrift:** Plus Jakarta Sans (Google Font) – durchgängig
- **Server-Logik:** Next.js Route Handlers / Server Actions; geplante Jobs via Supabase `pg_cron` + Edge Functions (Ersatz für `wp_cron`)
- Keine Secrets im Client. API-Keys nur server-seitig (env / Supabase Vault).

### Design-Sprache (verbindlich)
Schlicht, modern, premium, **nicht überladen**, klares UX/UI, dezente Animationen.

| Zweck | Farbe |
|---|---|
| Primär / Dunkel | `#1C244B` |
| Heller Hintergrund | `#F3F5F8` |
| Erfolg / Bezahlt | `#10b981` |
| Warnung / Prüfung | `#f59e0b` |
| Fehler / Offen / Abgelehnt | `#f87171` bzw. `#dc2626` |

Status-Badges, Karten mit weichem Schatten, Hover-Lift (`translateY(-1px/-2px)`), abgerundete Ecken (8–16px). Mobile-first, voll responsive.

---

## 2. Rollen & Auth

- **Schüler (student):** Supabase-Auth-User. Konto wird vom **Admin** erstellt (Name, Adresse, E-Mail, optional Telefon, optional Weiterempfehlungscode). Der Schüler setzt sein Passwort selbst beim ersten Login (Invite/Magic-Link-Flow von Supabase).
- **Admin (David):** eine einzelne Admin-Rolle. Sieht und verwaltet alles.

`profiles.role ∈ {'student','admin'}`. **RLS:** Schüler sehen ausschliesslich ihre eigenen Daten; Admin sieht alles. Jede Tabelle bekommt entsprechende Policies.

---

## 3. Datenmodell (Supabase – Vorschlag, gerne verfeinern)

Das alte System speicherte alles in WordPress-`user_meta`, globalen `options` und der Plugin-Tabelle `ssa_appointments`. Das wird in saubere relationale Tabellen überführt.

### `profiles` (erweitert `auth.users`)
`id (uuid, FK auth.users)`, `role`, `full_name`, `email`, `phone`, `address`, `referral_code`, `notes (bemerkung)`, `created_at`
**Preise** (manuell pro Schüler): `price_single` (default 85), `price_10er` (default 70), `price_20er` (default 65), `travel_surcharge` (Wegaufschlag, default 0)

> Der „aktive Preis" (alt `schueler_preis`, Format „CHF 70") = Basispreis je nach aktivem Paket **+** `travel_surcharge`. Wird beim Speichern berechnet und für Buchung/Rechnung verwendet.

### `packages` (aktuelles + Historie)
`id`, `student_id`, `type ∈ {'single','10er','20er'}`, `lessons_total (0/1/10/20)`, `name`, `price_per_lesson`, `total_price`, `payment_method ∈ {'twint','qr'}`, `starts_at`, `expires_at`, `status ∈ {'active','exhausted','cancelled','expired'}`, `paused (bool)`, `pause_remaining_seconds`, `paused_at`, `created_at`
- Gültigkeit: **10er = 5 Monate, 20er = 10 Monate** ab `starts_at`.
- „Verbrauchte Lektionen" = Anzahl gebuchter Appointments mit `start_at >= starts_at`. Daraus „verbleibend" und Fortschritt.

### `appointments`
`id`, `student_id`, `package_id`, `start_at`, `end_at`, `status ∈ {'booked','pending','cancelled','completed','no_show'}`, `payment_status ∈ {'unpaid','pending_confirmation','paid','rejected','archived','cancelled'}`, `payment_method`, `payment_date`, `source ∈ {'public_request','admin_proposal','direct','reschedule'}`, `series_id (nullable uuid)`, `notes`, `google_event_id`, `created_at`, `updated_at`
- Dauer immer **45 Minuten**.

### `booking_requests` (alt: `eigene_terminanfragen`)
`id`, `student_id`, `desired_start`, `status ∈ {'open','accepted','rejected','withdrawn'}`, `type` (immer `'public_request'`), `lessons_count ∈ {1,5,10}`, `interval_days ∈ {7,14}`, `notes`, `calculated_price`, `created_at`, `processed_at`, `created_appointment_ids (uuid[])`

### `proposals` (alt: `vorgeschlagene_termine`, Admin → Schüler)
`id`, `student_id`, `proposed_start`, `status ∈ {'open','accepted','rejected'}`, `lessons_count`, `interval_days`, `created_at`

### `reschedule_requests` (alt: `alternative_terminvorschlaege`)
`id`, `student_id`, `appointment_id`, `original_start`, `proposed_start`, `reason`, `status ∈ {'open','accepted','rejected','withdrawn'}`, `request_type ∈ {'reschedule','alternative'}`, `created_at`

### `absences`
`id`, `scope ∈ {'admin','student'}`, `student_id (null bei admin)`, `title`, `start_date`, `end_date`, `auto_extend (bool, default true)`, `created_at`

### `time_blocks` (alt: `admin_time_blocks`)
`id`, `title`, `date`, `start_time`, `end_time`, `created_at`

### `time_block_rules` (alt: `admin_time_block_rules`, Wiederholung)
`id`, `title`, `start_date`, `start_time`, `end_time`, `interval_days ∈ {7,14}`, `created_at`

### `invoices` (QR-Rechnungen)
`id`, `invoice_number` (Format `PIANO-{JAHR}-{0001}`, fortlaufend), `student_id`, `appointment_id`, `amount`, `payer_name`, `payer_address`, `status ∈ {'unpaid','pending_confirmation','paid','rejected','archived'}`, `method`, `pdf_url`, `access_token`, `lesson_date`, `created_at`, `paid_at`

### `package_extensions` (Timer-Log)
`id`, `student_id`, `absence_id`, `days_added`, `reason`, `created_at`

### `scheduled_emails` (Ersatz für `wp_schedule_single_event`)
`id`, `type`, `payload (jsonb)`, `send_at`, `sent_at (nullable)`, `status ∈ {'pending','sent','cancelled'}`

### `settings` / env
Google Calendar ID, Service-Account-JSON, Event-Map (alt `ku_google_event_map`), Rechnungs-Counter. Sensibles in env/Vault, nicht in Klartext-Tabellen.

---

## 4. Buchungssystem – Kernregeln

Diese Regeln gelten **systemweit** (öffentliche Buchung, Admin-Buchung, Verschiebung):

- **Lektionsdauer:** 45 Min.
- **Pufferzeit:** vor und nach jedem Termin (alt teils 15, teils 30 Min – im alten Code inkonsistent). **→ Setze konfigurierbar, Default 15 Min, und frage David, ob 15 oder 30 gewünscht ist.** Puffer blockiert benachbarte Slots bei Kollisionsprüfung.
- **24-Stunden-Regel:** Anfragen, Stornierungen und Verschiebungen nur **mindestens 24h im Voraus**. Frontend **und** Backend prüfen (nie nur Client vertrauen).
- **Verfügbare Zeitfenster (wochentagsspezifisch), 15-Min-Raster:**
  - **Mo–Do:** 16:30 – 20:30
  - **Fr:** 16:30 – 18:00
  - **Sa/So:** keine Termine
- **Kollisionsprüfung:** kein Überlappen mit bestehenden `booked`-Terminen (inkl. Puffer), nicht an Admin-Abwesenheiten, nicht in `time_blocks`/aktiven `time_block_rules`, nicht an gesperrten Tagen.
- **Serien:** `lessons_count ∈ {1,5,10}`, `interval_days ∈ {7,14}`. Serie wird transaktional erstellt (alle oder keine). Bei Serien: vorher **jeden** Slot auf Kollision/Abwesenheit prüfen, dann erst buchen.

### Buchungs-Flows (alle erhalten)

1. **Öffentliche Terminanfrage** (Schüler über Kalender-Widget): erzeugt `booking_requests` (status `open`). Admin nimmt an → erzeugt `appointments` (ggf. Serie) → Mails. Admin lehnt ab → Mail.
2. **Admin-Vorschlag** (`proposals`): Admin schlägt Termin/Serie vor → Schüler bestätigt im Portal → wird gebucht.
3. **Direkte Buchung** (Admin): sofort gebuchter Termin, keine Bestätigung nötig.
4. **Verschiebung** (`reschedule_requests`, `request_type='reschedule'`): Schüler beantragt neuen Termin für bestehende Lektion (nur ≥24h). Admin nimmt an → **alter Termin gelöscht, neuer direkt gebucht** → Mail. Admin lehnt ab → alter Termin bleibt → Mail.

Beim Annehmen einer Buchung/Serie muss der Payment-Hook ausgelöst werden (siehe Zahlung): je nach `payment_method` des Schülers eine QR-Rechnung oder eine TWINT-Zahlungsmail **planen** (nicht sofort senden).

---

## 5. Pakete & Preise

- **Pakettypen:** Einzellektion (`single`), 10er (5 Mon. gültig), 20er (10 Mon. gültig).
- **Neues Paket** nur buchbar, wenn das alte **aufgebraucht oder abgelaufen** ist – sonst Button deaktiviert mit Hinweis „noch X Lektionen offen".
- **Preise pro Schüler** manuell (überschreiben Distanzberechnung): `price_single` (85), `price_10er` (70), `price_20er` (65), je `+ travel_surcharge`. Aktiver Preis richtet sich nach aktivem Paket.
- **Paketkauf-Flow im Schülerportal:** Auswahl 10er/20er → Modal mit Paketdetails + verlinkten AGB + Pflicht-Häkchen → „verbindlich buchen" → Paket aktiviert, `starts_at`/`expires_at` gesetzt, `total_price` gespeichert.

### Paket-Stornierung (wichtig, exakt übernehmen)
- Stornierbar **bis zur 3. gebuchten Lektion**. **Ab der 4.** Lektion **nicht** mehr.
- Bei Stornierung werden bereits gebuchte Lektionen zum **Einzeltarif** verrechnet.
- Einzelpreis-Berechnung aus dem Paketpreis:
  - 20er-Paket: `wegkosten = max(0, paketpreis − 55)`
  - sonst: `wegkosten = max(0, paketpreis − 60)`
  - `einzelpreis = 70 + wegkosten`
- Stornierungsstatus + Abrechnung speichern; Admin kann „als bezahlt markieren" → Bestätigungsmail.
- Im Schülerportal dezenter Stornierungslink/-Toggle (klein), kein prominenter Button.

---

## 6. Zahlungssystem

Es gibt **zwei** Zahlungsarten je Schüler (`payment_method`): **TWINT** oder **QR-Rechnung**. Beide nutzen denselben Status-Workflow und **manuelle Bestätigung** durch den Admin.

### Status-Workflow (beide)
`unpaid` → (Schüler klickt „Ich habe bezahlt") → `pending_confirmation` → (Admin) `paid` **oder** `rejected`. Zusätzlich `archived` (aus Liste entfernt) und bei Terminabsage automatisch `cancelled`/`archived`.

### Zeitliche Regel (beide)
- Zahlungsaufforderung (Button im Portal **und** E-Mail) erscheint/wird gesendet **erst nachdem die Lektion stattgefunden hat** (nach `end_at`).
- Umsetzung: Beim Buchen einen Eintrag in `scheduled_emails` mit `send_at = end_at` anlegen. Ein Cron-Job (pg_cron / Vercel Cron, minütlich/5-min) versendet fällige, noch nicht bezahlte/archivierte Zahlungen via Resend.

### TWINT
- Reiner Deep-Link (kein echtes Payment-API): Basis-URL + `trxInfo` (Lektionsinfo) + `amount`. Klick öffnet TWINT, setzt Status auf `pending_confirmation`.
- Bei Absage des Termins → Status `cancelled`.

### QR-Rechnung (Schweizer QR)
- PDF wird über die **LivingTech QR-Bill API** erzeugt (HTTP-API mit API-Key – serverseitig aus Next.js Route Handler / Edge Function aufrufen, API-Key in env). Endpoint, Parameter (Account/IBAN, Creditor, Debtor, Amount, UnstructuredMessage „Klavierunterricht – Rechnung {Nr}", Currency CHF, Format PDF, Language DE) wie im bestehenden PHP-Code.
- Falls API fehlschlägt: Fallback auf rohen Swiss-QR-Datenstring (SPC-Format) wie im alten Code.
- IBAN/Adresse (Creditor) als Konfiguration:
  - IBAN `CH68 0830 7000 5411 7930 6`
  - David Ramchandani, Sattleracherstrasse 59, 8413 Neftenbach
- PDF sicher speichern/ausliefern: nur für eingeloggten Schüler **oder** über signierten `access_token` (für Mail-Links ohne Login). Bei Supabase: privater Storage-Bucket + signierte URLs.
- Rechnungsnummer fortlaufend: `PIANO-{Jahr}-{0001}`.
- Bei Terminabsage: Rechnung archivieren + PDF löschen + Admin-Info-Mail.

### Admin-Sicht Zahlungen
Pro Schüler Liste aller offenen/Prüf-/bezahlten Posten mit Aktionen: **Bezahlt bestätigen**, **Ablehnen**, **Mail erneut senden**, **Archivieren**. Statusänderung muss Schüler-Portal und Termin (`payment_status`) konsistent updaten.

---

## 7. Abwesenheiten & Timer-Logik

- **Admin-Abwesenheiten** (`scope='admin'`): blockieren Buchungen für **alle**. Bei `auto_extend` wird der Paket-Timer aller Schüler pausiert/verlängert.
- **Schüler-Abwesenheiten** (`scope='student'`): blockieren nur diesen Schüler, verlängern dessen Timer.
- **Timer-Verlängerung:** `expires_at += (Tage der Abwesenheit, inklusive)`. Log in `package_extensions`. Beim Löschen einer Abwesenheit: Verlängerung **zurückrechnen**.
- **Manuelle Pause/Fortsetzen** des Timers pro Schüler:
  - Pause: Restzeit (`expires_at − now`) als `pause_remaining_seconds` speichern, `paused=true`.
  - Fortsetzen: `expires_at = now + pause_remaining_seconds`, Pause-Felder leeren.
  - Verlängerung während Pause: addiert zu `pause_remaining_seconds`.
- **Zeitblöcke** (`time_blocks`): einzelne gesperrte Zeitfenster an einem Datum. **Regeln** (`time_block_rules`, `count=0` = unbegrenzt) generieren wiederkehrende Blöcke (7 oder 14 Tage). Batch-Anlage + „Warteschlange" wie im alten UI ist nice-to-have, nicht Pflicht.
- Timer-Anzeige im Schülerportal: „Läuft in X ab" / „Pausiert" / „Abgelaufen", inkl. Hinweis auf kommende Abwesenheit.

---

## 8. Google Calendar Sync (One-Way: System → Google)

- **Service Account (JWT, RS256)** → Access Token holen (wie im alten PHP: Header+Claim base64url, mit `private_key` signieren, gegen `oauth2.googleapis.com/token`). In Next.js/Edge mit `crypto`/jose umsetzen, Token cachen (~55 Min).
- Bei **gebuchtem/geändertem** Termin: Event in Google Calendar anlegen/updaten (Titel „Klavierunterricht – {Name}", Ort = Schüleradresse oder „Hausbesuch – {Name}", Beschreibung mit Name/E-Mail/Status, Zeitzone `Europe/Zurich`, Erinnerung 30 Min, colorId je Status).
- Bei **storniert/no_show**: Event löschen.
- `appointments.google_event_id` als Map (Ersatz für `ku_google_event_map`).
- Sync asynchron/verzögert (Queue oder kurze Verzögerung), damit Buchung nicht blockiert.
- **Einstellungsseite** (Admin): Calendar-ID + Service-Account-JSON eingeben, Verbindungsstatus testen, „Vollsync" aller zukünftigen `booked`-Termine.

---

## 9. E-Mails (Resend)

Alle bisherigen Mails übernehmen, im einheitlichen Design (Plus Jakarta Sans, `#1C244B`-Header, weiches Layout). Du-Form, Signatur „Liebe Grüsse / David Ramchandani".

| Anlass | Empfänger |
|---|---|
| Terminanfrage eingegangen (inkl. Serie) | Schüler |
| Neue Terminanfrage | Admin |
| Terminbestätigung / Serie bestätigt (mit Google- **und** iCal-Link; iCal als wiederkehrende Serie) | Schüler |
| Terminablehnung (mit optionalem Grund) | Schüler |
| Neuer Terminvorschlag (Admin → Schüler) | Schüler |
| Verschiebungsanfrage erhalten | Admin + Schüler (Bestätigung) |
| Verschiebung bestätigt | Schüler |
| Stornierungsbestätigung | Schüler + Admin |
| Anfrage zurückgezogen | Admin |
| TWINT-Zahlungsaufforderung (nach Lektion, mit Restlektions-/Timer-Hinweis) | Schüler |
| QR-Rechnung (nach Lektion, PDF-Link) | Schüler |
| Zahlung bestätigt | Schüler |
| Zahlung nicht gefunden / abgelehnt | Schüler |
| Stornierungsbetrag bezahlt | Schüler |
| Bewertungs-Mail | Schüler |

- **iCal-Download** für Schüler/Serien (mit `VALARM` 24h vorher) als signierter Link ohne Login möglich (Token).
- SMS war im alten System optional via `send_sms_via_curl` – **vorerst weglassen**, nur als Stelle markieren, falls David das später will.

---

## 10. Schülerportal – Funktionsumfang

Nach Login persönliches Portal mit:
1. **Aktuelles Paket:** Typ, verbleibende/verbrauchte Lektionen, Fortschrittsbalken, Restlaufzeit (Timer), Status-Badge (Aktiv/Pausiert/Aufgebraucht/Abgelaufen/Kein Paket), Hinweis auf kommende Abwesenheit. „Nächste Lektion buchen"-Button (führt zur Buchung; nur wenn Paket aktiv & nicht pausiert).
2. **Neues Paket buchen:** nur wenn altes aufgebraucht/abgelaufen (sonst deaktiviert). 10er/20er mit Preis/Lektion → Modal (Details + AGB-Häkchen) → buchen.
3. **Lektion buchen** übers Buchungssystem (Termine ziehen vom Paket ab).
4. **Meine Termine:** Listen- **und** Kalenderansicht. `.ics`-Download + Google-Kalender-Link. **Verschieben/Stornieren nur ≥24h vorher.** Status-Badges. Eigene offene Terminanfragen sichtbar + zurückziehbar.
5. **Zahlungen:** je nach `payment_method` TWINT-Button oder QR-Rechnung. Button/Rechnung erst **nach** der Lektion. „Ich habe bezahlt" → Status `pending_confirmation`. Badges (Offen/Prüfung/Bezahlt/Abgelehnt). Bezahlte/abgelehnte Einträge entfernbar.
6. **Paket-Stornierung** (dezent), nur bis 3. Lektion (siehe Abschnitt 5).

## 11. Admin-Portal – Funktionsumfang

1. **Schülerübersicht:** alle Schüler als Karten/Tabelle, durchsuchbar. Pro Schüler: Paketstatus, Restlaufzeit, verbleibende Lektionen, Buchungsrhythmus, nächste Lektion, offene Vorschläge/Verschiebungen.
2. **Schülerdetails:** Kontaktdaten editieren, **Preise setzen** (Einzel/10er/20er/Wegaufschlag + Live-Vorschau, aktualisiert aktiven Preis), Zahlungsart, Bemerkungen, Bezahl-Status, TWINT-/QR-Posten verwalten.
3. **Schüler anlegen** (Invite-Flow): Name, Adresse, E-Mail, optional Telefon/Weiterempfehlungscode.
4. **Terminverwaltung:** offene öffentliche Anfragen annehmen/ablehnen (inkl. Serie). Neuen Termin/Serie vorschlagen (Schüler + Anzahl + Intervall). Direkte Buchung.
5. **Verschiebungen/Alternativen:** annehmen (alt löschen, neu buchen) / ablehnen.
6. **Kalender (Admin):** Monat/Woche/Tag, alle Termine + Vorschläge + Anfragen, Statusfilter, Schülerfilter, Termin bestätigen/stornieren, Google-Sync-Status & Vollsync.
7. **Abwesenheiten & Zeitblöcke:** Admin-/Schüler-Abwesenheiten anlegen/löschen, Timer pausieren/fortsetzen/verlängern, Zeitblöcke + Wiederholungsregeln.
8. **Zahlungen verwalten:** bestätigen/ablehnen/Mail erneut/archivieren (TWINT + QR).
9. **Bewertungs-Mail** versenden (optional, falls Rating-System mitkommt).

---

## 12. Datenmigration aus WordPress

Es existieren echte Bestandsdaten. Schreibe ein **Migrationsskript** (z. B. Node-Script gegen WP-DB-Export / REST), das mappt:

- WP-`subscriber`-User → `profiles` (role `student`).
- `user_meta`: `termine_max`, `paket_name`, `package_start/expiry`, `schueler_preis_*`, `schueler_wegaufschlag`, `paket_total_preis`, `zahlungsart`, `telefon_nummer`, `schueler_adresse`, `bemerkung`, `bezahlt`, `lektionen_bezahlt` → `profiles`/`packages`.
- `wp_ssa_appointments` → `appointments` (Status-Mapping: `canceled`/`cancelled` vereinheitlichen; `customer_information`-JSON → `payment_status`/`payment_method`/`notes`).
- `eigene_terminanfragen` → `booking_requests`; `vorgeschlagene_termine` → `proposals`; `alternative_terminvorschlaege` → `reschedule_requests`.
- `student_absences` + Option `admin_absences` → `absences`; `admin_time_blocks`/`admin_time_block_rules` → `time_blocks`/`time_block_rules`.
- `qr_all_invoices` + `qr_rechnungen_*` → `invoices` (+ Counter).
- `ku_google_event_map` → `appointments.google_event_id`.

Migration **idempotent** (mehrfach ausführbar ohne Duplikate, z. B. via Upsert auf E-Mail / externe ID).

---

## 13. Sicherheit & Qualität

- RLS für jede Tabelle. Server-seitige Validierung aller Geschäftsregeln (24h, Slots, Paketstatus, Stornierfristen) – nie nur im Client.
- Alle Geld-/Zeitberechnungen serverseitig, in `Europe/Zurich`.
- Idempotenz bei Buchung (Doppelklick-/Doppelanfrage-Schutz, alt via Transient → hier z. B. eindeutiger Constraint oder kurzer Lock).
- Secrets ausschliesslich in env / Supabase Vault.

---

## 14. Empfohlene Reihenfolge (Meilensteine)

Baue genau in dieser Reihenfolge. Nach jedem Schritt: Build grün + kurze Zusammenfassung.

1. **Fundament:** Supabase-Schema + Migrations + RLS-Policies. Seed mit 1 Admin + 1 Testschüler.
2. **Auth & Profile:** Login, Admin-Schüler-Anlage (Invite), Passwort-Setzen.
3. **Pakete:** Anzeige, Kauf-Flow, Timer-Berechnung (ohne Abwesenheits-Pause vorerst).
4. **Buchungs-Engine (Core):** Slot-Berechnung (Wochentage, Puffer, 24h, Kollisionen, Abwesenheiten, Zeitblöcke). Reine Server-Logik mit Tests.
5. **Öffentliche Terminanfrage + Admin-Annahme** (inkl. Serie).
6. **Schülerportal Termine:** Liste/Kalender, .ics, Verschieben/Stornieren (24h).
7. **Admin-Portal:** Schülerübersicht/-details, Preise, Vorschläge, Direktbuchung, Verschiebungen, Admin-Kalender.
8. **Abwesenheiten & Timer-Pause/Verlängerung & Zeitblöcke.**
9. **Zahlungen:** Status-Workflow, geplante Mails (Cron), TWINT-Deeplink, QR via LivingTech, Admin-Verwaltung.
10. **Paket-Stornierung** mit Einzelpreis-Logik.
11. **E-Mails (Resend)** vollständig + Templates.
12. **Google Calendar Sync** + Einstellungsseite + Vollsync.
13. **Datenmigrationsskript.**
14. **Politur:** Design, Animationen, Mobile, Leerzustände, Fehlerfälle.

---

## 15. Offene Punkte (bei David rückfragen, bevor relevant)

1. **Pufferzeit:** 15 oder 30 Minuten? (Alt-Code widersprüchlich.)
2. **TWINT-Basis-Link** und **LivingTech-API-Key**: aus env/Secret beziehen – wo abgelegt?
3. **Google Service-Account-JSON** + Calendar-ID: vorhanden?
4. **Weiterempfehlungscode**: nur speichern oder soll daraus eine Logik folgen (Rabatt o. Ä.)?
5. **Bewertungs-/Rating-System**: mitmigrieren oder vorerst weglassen?
6. **AGB- und Kaufprozess-Texte** sowie die genauen Zahlungs-Mailtexte werden von David noch bereitgestellt.
7. **SMS-Versand**: vorerst weglassen – korrekt?

---

**Wichtig:** Erfinde keine Geschäftsregeln dazu. Was hier nicht steht und unklar ist, wird gefragt – nicht geraten.
