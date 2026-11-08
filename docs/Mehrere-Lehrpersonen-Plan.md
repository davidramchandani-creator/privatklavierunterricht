# Umbau auf mehrere Lehrpersonen: Analyse und Umsetzungsplan

Stand: 6. November 2026. Ziel: Ab Semesterstart FS27 (22.02.2027) unterrichtet mindestens eine angestellte Lehrperson neben David. Grundprinzip: **Alles läuft über David.** Lehrpersonen antworten oder melden, David entscheidet. Kunden haben nur mit David bzw. privatklavierunterricht.ch Kontakt.

Noch nichts ist umgesetzt. Dieser Plan wartet auf Davids Freigabe und die Antworten unter „Offene Fragen“.

---

## 1. Was die Analyse ergeben hat

### Rollen und Rechte
- Es gibt **zwei Rollensysteme nebeneinander**: `profiles.role` (erlaubt nur `admin`, `student`) und die Tabelle `profile_roles` (`admin`, `schueler`). `is_admin()` liest `profile_roles`, die Policy auf `lektionsnotizen` liest dagegen `profiles.role`. Für eine dritte Rolle muss das zuerst vereinheitlicht werden, sonst gilt eine Lehrperson je nach Tabelle als etwas anderes.
- RLS ist auf allen 46 Tabellen eingeschaltet, kennt aber nur zwei Fälle: „eigene Daten“ (Schüler) und „alles“ (Admin).
- **Zwei Tabellen sind öffentlich lesbar**: `admin_verfuegbarkeit` und `time_blocks` (`using (true)`). Heute harmlos, mit mehreren Lehrpersonen wären ihre Arbeitszeiten und gesperrten Zeiten für jeden lesbar. Muss geschlossen werden.
- Der Server arbeitet an **190 Stellen mit dem Service-Schlüssel** (`createAdminClient`), der RLS umgeht. Die Sicherheit liegt dort in `assertAdmin()` je Action. Für das Lehrpersonen-Portal heisst das: Es darf **nie** den Service-Schlüssel verwenden, sondern nur die Sitzung der Lehrperson, damit RLS wirklich greift. Ein Test soll das erzwingen.
- `profiles` enthält Preise (`price_*`, `travel_surcharge`), Zahlungsart und Notizen. RLS kann keine einzelnen Spalten sperren. Lehrpersonen dürfen `profiles` darum gar nicht lesen, sondern nur eine eingeschränkte Sicht (Vorname, Unterrichtsadresse erst nach Zuteilung).

### Stellen, die heute „eine Lehrperson“ voraussetzen
| Bereich | Heute | Künftig |
|---|---|---|
| Arbeitszeiten | `admin_verfuegbarkeit`, global | pro Lehrperson |
| Gesperrte Zeiten | `time_blocks`, `time_block_rules`, Apple-Kalender-Import | pro Lehrperson (Apple nur David) |
| Abwesenheiten | `absences.scope = 'admin'` sperrt alle | pro Lehrperson, „Admin“ = David |
| Kollisionsprüfung | alle gebuchten Termine | nur Termine derselben Lehrperson |
| Lücken-Logik (keine zerstückelten Blöcke) | global | pro Lehrperson |
| Startpunkt Routen/Distanz | `app_settings.routenplanung_zuhause` | pro Lehrperson (intern) |
| Studio-Adresse und Pause 10 Min | David | nur David; Hausbesuch mit Fahrzeit |
| Google- und Apple-Kalender-Feed | Davids Kalender | David sieht alles, Lehrperson nur ihre Termine |
| Freie Plätze, Warteliste, Platzhinweis | Davids Zeiten | David; Region Winterthur und Zürich separat |
| Terminplanung/Zuteilung, Vorrücken, Freigaben | David | pro Lehrperson |
| Probelektion mit freien Slots | Davids Slots öffentlich | bleibt nur David (Kunden sehen nie Zeiten von Lehrpersonen) |

Betroffen sind vor allem `booking-server.ts`, `booking-gap.ts`, `fixplatz-*.ts`, `freigabe-server.ts`, `vorrueck-server.ts`, `routing-server.ts`, `planung-server.ts`, `google-calendar.ts`, `kalender-feed-server.ts`, `semester-umstellung-server.ts`, `subscription-jobs.ts` sowie `src/app/admin/actions.ts` (4'650 Zeilen).

### Was schon da ist und genutzt werden kann
- Geokodierung (`profiles.lat/lng`, `travel_times`) und das alte Wegkosten-Feld `travel_surcharge` für die Fahrpauschale.
- Mail-Outbox mit Abschaltung pro Mailtyp, Empfänger-Auflösung an einer Stelle (`email-dispatch.ts`).
- Lektionsnotizen, „Was lief?“ (durchgeführt markieren), Warteliste, Anfragen.
- Semester, unterrichtsfreie Zeiten und Preise sind bereits zentral.

---

## 2. Datenmodell (Vorschlag)

- `teachers`: id, profile_id (Login), vorname, nachname, foto_url, kurztext (veröffentlicht), kurztext_entwurf, unterrichtsorte (`zuhause`, `hausbesuch`), adresse_zuhause (intern), startpunkt_lat/lng (intern), region, altersgruppen, status (`aktiv`/`inaktiv`), startdatum, lohn_pro_lektion, ist_inhaber (David).
- `teacher_id` (not null nach Backfill) auf: `appointments`, `packages`, `booking_requests`, `proposals`, `reschedule_requests`, `absences`, `time_blocks`, `time_block_rules`, `admin_verfuegbarkeit`, `planungsrunden`, `lesson_ausfaelle`, `lektionsnotizen`, Schülerzuordnung (`profiles.teacher_id` oder eigene Tabelle).
- `schueler_anfragen_lehrperson`: Anfrage von David an eine Lehrperson (anonymisierte Angaben, Distanz), Antwort `zeit`/`keine_zeit` mit Terminvorschlag, Status `offen`/`vergeben`/`zugeteilt`.
- `meldungen`: von Lehrperson an David (Absage, Verschiebung, Abwesenheit, Profiltext), Status, Begründung, entschieden_am.
- `leitbild_versionen` und `leitbild_bestaetigungen`.
- `audit_log`: tabelle, datensatz_id, aktion, alt (jsonb), neu (jsonb), wer (auth.uid), wann. Ein gemeinsamer Trigger auf allen relevanten Tabellen, damit keine Änderung durchrutscht, auch nicht über den Service-Schlüssel (dann mit dem Akteur aus der Action).
- Phase 2: `lohnabrechnungen`, `lohnzeilen`, `feedback`.

**Migration ohne Datenverlust:** David wird als erster Eintrag in `teachers` angelegt (`ist_inhaber = true`). Jede neue Spalte `teacher_id` kommt zuerst nullable, wird per Backfill auf David gesetzt, geprüft (Zählung vorher/nachher pro Tabelle) und erst dann `not null`. Kein bestehender Datensatz wird gelöscht oder umgeschrieben, nur ergänzt. Vor der Migration wird ein Datenbank-Backup (Supabase Point-in-Time oder Dump) gezogen.

---

## 3. Phase 1, in fünf Schritten (bis Februar 2027)

Jeder Schritt endet mit grünem Build, Tests und einer Testliste. Davids heutige Abläufe müssen nach jedem Schritt unverändert funktionieren.

### 1a Fundament (ca. 2 Wochen) — erledigt am 6. November 2026
Umgesetzt: Sicherungskopie `backup_20261106` (45 Tabellen, 893 Zeilen), Migration 071 (Rolle `lehrperson`, Tabelle `teachers` mit David als Inhaber, `teacher_id` auf 12 Tabellen und bei Schülern, Vorgabe David, Audit-Log mit Trigger auf 23 Tabellen, Arbeitszeiten und Sperren nicht mehr öffentlich, Admin-Prüfung einheitlich über `is_admin()`), Middleware mit `/lehrperson`, Platzhalter-Portal, Admin-Seite „Protokoll“, RLS-Test `supabase/tests/rls_lehrpersonen.sql`.
Bekannte Grenze: Änderungen über den Service-Schlüssel (Admin-Aktionen, Jobs) stehen im Protokoll als „Server“, ohne Person. Aktionen aus dem Lehrpersonen-Portal tragen die Person.

- Rollen vereinheitlichen, neue Rolle `lehrperson`, Hilfsfunktionen `is_lehrperson()`, `own_teacher_id()`.
- Tabelle `teachers`, David anlegen, `teacher_id` überall ergänzen und auf David setzen.
- Audit-Log mit Trigger.
- RLS verschärfen: `admin_verfuegbarkeit` und `time_blocks` nicht mehr öffentlich (die Probelektion liest weiter über den Server).
- RLS-Testsuite: SQL-Tests, die sich als Schüler, Lehrperson A, Lehrperson B und Admin anmelden und prüfen, was lesbar und schreibbar ist. Laufen bei jeder Migration mit.
- Gegenprobe: Davids Slots, Fixplatzsuche, Semester-Umstellung, Raten und Rechnungen liefern vorher und nachher dasselbe.

### 1b Lehrpersonen-Verwaltung, öffentliche Seite, Leitbild (ca. 1 Woche)
- Admin: Lehrpersonen anlegen, bearbeiten, deaktivieren, Foto hochladen (Storage), Profiltext freigeben.
- Webseite: Seite „Wer unterrichtet dich?“ und Abschnitt auf der Startseite, nur aktive Lehrpersonen, nur freigegebene Texte, keine Kontaktdaten.
- Leitbild: Admin-Seite mit Versionen, Bestätigung durch Lehrpersonen, Übersicht wer was bestätigt hat.

### 1c Buchungslogik pro Lehrperson (ca. 2 bis 3 Wochen, der heikelste Teil)
- Arbeitszeiten, Sperren, Abwesenheiten, Kollisionen und Lücken-Logik pro Lehrperson.
- Hausbesuch mit Fahrzeit als Puffer (aus `travel_times`), Studio-Pause nur bei David.
- Semester-Umstellung, Verlängerung, Vorrücken, Freigaben berücksichtigen die Lehrperson.
- Kalender: Davids Feed zeigt alles (mit Name der Lehrperson), jede Lehrperson bekommt einen eigenen Feed nur mit ihren Terminen.

### 1d Anfragen, Zuteilung, Fahrpauschale (ca. 2 Wochen)
- Anmeldeformular und Probelektion: Auswahl „Studio Neftenbach (bei David)“ oder „Hausbesuch / bei einer Lehrperson in der Region Winterthur und Zürich“, dazu Tage, Zeiten, Alter, Niveau. Alles landet bei David.
- Admin: Anfrage an eine oder mehrere Lehrpersonen schicken (Vorname, Alter, Niveau, Quartier, Zeiten, Distanz), Antworten sehen, per Klick zuteilen. Erst dann sieht die Lehrperson die Adresse, Schüler, Abo und Termine werden mit ihrer `teacher_id` angelegt, der Kunde bekommt die Bestätigung mit Lehrperson, Ort und Termin, die anderen „Anfrage vergeben“.
- Fahrpauschale: erste 5 km gratis, danach CHF 5 pro angefangene 5 km pro Lektion, aus der Distanz Startpunkt der Lehrperson zur Schüleradresse. Separat auf der Rechnung, pro Schüler überschreibbar, für den Lohn separat als Spesen erfasst. TWINT- und QR-Logik bleibt, die Pauschale ist eine eigene Rechnungszeile bzw. ein eigener Betrag.

### 1e Lehrpersonen-Portal und „Offen“ (ca. 2 Wochen)
- Eigener Bereich `/lehrperson`, in der Middleware geschützt, nur mit der Sitzung der Lehrperson (kein Service-Schlüssel, per Test erzwungen).
- Sieht: Anfragen von David, eigene Termine, Vorname und Adresse der eigenen Schüler, Lektionsnotizen, Leitbild.
- Darf direkt: auf Anfragen antworten, Lektion als durchgeführt markieren, Notiz schreiben.
- Darf nur melden: Absage, Verschiebung, Abwesenheit, Profiltext.
- Admin-Ansicht „Offen“: alle Antworten und Meldungen, Freigeben oder Ablehnen mit Begründung. Die Lehrperson bekommt Bescheid, der Kunde erst nach Davids Freigabe und nur vom System.
- Mails: an Lehrpersonen (neue Anfrage, Zuteilung, Entscheid), an David (Antwort, Meldung). Alle Kundenmails nennen Lehrperson und Ort.

**Zeitplan:** etwa 9 bis 10 Wochen Arbeit. Mit Start Mitte November ist das bis Ende Januar machbar, mit drei Wochen Reserve für Tests mit der ersten Lehrperson vor dem 22. Februar.

---

## 4. Phase 2 (ab März 2027)

8. **Lohnabrechnung:** Monatsübersicht pro Lehrperson (durchgeführte Lektionen × Grundlohn, Ferienentschädigung separat, Brutto, Abzüge, Netto, Fahrspesen separat), Freigabe durch David, PDF an die Lehrperson, Jahresübersicht für die SVA, Warnung beim Grenzbetrag. Alle Sätze und Grenzbeträge als Einstellung, nicht fest im Code, weil sie sich ändern.
9. **Feedback:** Formulare für Schüler (nach 5 Lektionen, Semesterende) und Lehrpersonen, nur David sieht die Antworten.
10. **Auswertung:** Umsatz, Lohnkosten inkl. Arbeitgeberabgaben, Marge pro Lehrperson und gesamt, Schüler pro Lehrperson, offene Anfragen und Meldungen.

---

## 5. Entscheide von David (6. November 2026)

1. **Preise:** Neue Schüler zahlen die Preise auf der Webseite (95 / 80 / 75). Bestandsschüler zahlen ihren bisherigen Preis + CHF 5, auch Angela und Marina (Jahresabo). Ab wann genau: noch offen (1. Januar oder 22. Februar 2027).
2. **Preise bei Lehrpersonen:** gleich wie bei David.
3. **Lohn:** nur für durchgeführte Lektionen. Sagt der Schüler weniger als 24 Stunden vorher ab, wird die Lektion trotzdem bezahlt. Fällt die Lehrperson aus, organisiert sie selbst Ersatz, sonst kein Lohn.
4. **Lohn pro Lektion:** CHF 50 inklusive Ferienentschädigung. Bei 8.33 % (4 Wochen Ferien) sind das CHF 46.15 Grundlohn und CHF 3.85 Ferienentschädigung, auf jeder Abrechnung getrennt ausgewiesen. Ist die Lehrperson unter 20, gelten 5 Wochen (10.64 %): CHF 45.19 und CHF 4.81. Alter: noch offen.
5. **Unterricht bei der Lehrperson zu Hause:** Der Kunde bekommt nach der Zuteilung ihre Adresse.
6. **Gruppenunterricht:** nach Schritt 1a, sobald David eine Gruppe wirklich anbietet.
7. **Apple-Kalender:** nur David.

### Noch offen
- Preiserhöhung Bestandsschüler: ab 1. Januar 2027 (David). Raten Januar und Februar werden neu gerechnet.
- Ferienentschädigung: pro Lehrperson einstellbar (`teachers.ferien_prozent`, Vorgabe 8.33 %), Alter noch unbekannt.
- „Nicht erschienen“ zählt für den Lohn wie eine kurzfristige Absage (Vorschlag, als Einstellung mit Vorgabe „ja“).

## 6. Hinweise ausserhalb des Systems (keine Rechtsberatung)

- **Vereinfachtes Abrechnungsverfahren:** 5 % Quellensteuer (0.5 % Bund, 4.5 % Kanton und Gemeinde) stimmt. Die Grenze von CHF 22'680 pro Person ist in den gefundenen Quellen für 2023/24 belegt, zusätzlich darf die **gesamte Lohnsumme** aller Angestellten 2026 CHF 60'480 nicht übersteigen. Beides kann sich jährlich ändern, bitte bei der SVA Zürich für 2027 bestätigen lassen.
- **Unfallversicherung (UVG)** ist für Angestellte obligatorisch, auch bei kleinem Pensum. Ebenso Familienausgleichskasse (Arbeitgeberbeitrag).
- **Datenschutz:** Die Datenschutzerklärung muss erwähnen, dass zugeteilte Lehrpersonen Name, Adresse und Lektionsnotizen sehen. Im Arbeitsvertrag eine Schweigepflicht zu Schülerdaten aufnehmen.

Quellen: [Kanton Zürich, Quellensteuer im vereinfachten Verfahren](https://www.zh.ch/de/steuern-finanzen/steuern/quellensteuer/quellensteuer-abrechnen/quellensteuer-vereinfachtes-abrechnungsverfahren.html), [SECO, vereinfachtes Abrechnungsverfahren](https://www.seco.admin.ch/de/vereinfachtes-abrechnungsverfahren-bei-tiefen-lohnsummen), [AHV-Merkblatt 2.07](https://ahv-iv.ch/p/2.07.d), [Kanton Aargau, Merkblatt BGSA](https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/quellensteuer/quellensteuer-arbeitgebende/qust-merkblaetter-publikationen/vereinfachtes-abrechnungsverfahren-bgsa.pdf), [Steuerpraxis Thurgau](https://steuerpraxis.tg.ch/steuerpraxis/2026-09/stp-38a-nr-1-vereinfachtes-abrechnungsverfahren)
