# CI/CD: Was beim Deployen passiert

Kurz: **CD hast du, CI nicht.** Ein Push auf `main` geht automatisch live. Aber
kein Test und keine Lint-Regel hält dich dabei auf — die 606 Tests laufen nur,
wenn sie jemand von Hand startet.

Stand: August 2026. Next.js 16.2.6, Vercel, Supabase.

---

## Die Kette, so wie sie heute läuft

```
Commit auf main
      ↓
GitHub  (github.com/davidramchandani-creator/privatklavierunterricht)
      ↓  Vercel-Git-Integration, kein eigener Workflow
Vercel Build   →   next build auf Node 24
      ↓            (Typprüfung inbegriffen, Lint und Tests nicht)
Production     →   privatklavierunterricht.ch
```

Es gibt **keinen** Ordner `.github/workflows`. Es gibt keine GitLab-, Circle-
oder Husky-Konfiguration. Die einzige Datei im Repo, die etwas an der
Auslieferung einstellt, ist `vercel.json`.

| Auslöser | Was Vercel daraus macht |
|---|---|
| Push auf `main` | Production-Deployment auf die echte Domain |
| Push auf einen anderen Branch | Preview-Deployment unter eigener URL |
| Pull Request | Preview-Deployment, Link hängt am PR |

Preview-Deployments greifen auf **dieselbe** Supabase-Datenbank zu. Ein Preview
ist also kein sicherer Spielplatz: Was du dort klickst, passiert echt. Zum
gefahrlosen Ausprobieren siehe [Testen.md](./Testen.md).

---

## Was geprüft wird — und was nicht

Das ist der Teil, der zählt.

| Prüfung | Läuft beim Deployen? | Bricht der Build ab? |
|---|---|---|
| TypeScript (`tsc`) | **Ja**, in `next build` | Ja |
| ESLint | **Nein** | — |
| Vitest, 606 Tests | **Nein** | — |
| Datenbank-Migrationen | **Nein** | — |

Zwei Punkte davon sind Fallen:

**ESLint lief früher mit, heute nicht mehr.** Next.js 16 hat `next lint`
entfernt, und `next build` lintet seither nicht mehr. Falls du dich erinnerst,
dass Lint-Fehler mal einen Build gestoppt haben — das stimmt, das war eine
frühere Version. Heute geht ein Deployment mit Lint-Fehlern durch.

**Die Tests laufen nirgends automatisch.** 606 Stück, darunter die
Buchungslogik, der Routenplaner-Stresstest und alle Wächtertests, die
verhindern sollen, dass etwas still verschwindet. Sie sind genau so viel wert,
wie sie oft laufen. Wenn nie jemand `npm test` tippt, sind sie Dekoration.

Von Hand, alle drei zusammen:

```bash
npx tsc --noEmit && npx eslint . && npm test
```

---

## Die Datenbank fährt nicht mit

`supabase/migrations/*.sql` wird von **niemandem** automatisch ausgeführt. Der
Code geht live, das Schema bleibt stehen, bis jemand die Migration von Hand
gegen Supabase laufen lässt.

Daraus folgt eine Reihenfolge, von der du nicht abweichen solltest:

1. **Erst** die Migration in Supabase anwenden
2. **Dann** den Code pushen

Umgekehrt ist zwischen Deployment und Migration jeder Aufruf kaputt, der die
neue Spalte braucht — bei laufendem Betrieb, mit echten Schülern.

Bisher habe ich die Migrationen jeweils direkt angewandt, wenn wir zusammen
gearbeitet haben (zuletzt `056` bis `058`). Es gibt keinen Mechanismus, der das
nachholt oder auch nur meldet, dass es fehlt.

---

## Zwei Stolperfallen, die dich schon getroffen haben

### Der Cron, der alle Deployments blockiert hat

In `vercel.json` stand einmal:

```json
{ "path": "/api/cron/apple-kalender", "schedule": "*/15 * * * *" }
```

Der Vercel-Hobby-Plan erlaubt **nur tägliche** Cron-Ausdrücke. Etwas Häufigeres
lehnt Vercel ab — und zwar nicht den Cron, sondern **das ganze Deployment**.
Ohne Fehlermeldung, ohne Build-Log, ohne E-Mail. Es sah aus, als würde GitHub
nicht mehr auslösen.

Das kostete uns eine Weile Suche. Ein Wächtertest hält jetzt fest, dass alle
Cron-Ausdrücke dem täglichen Muster folgen. Er ist aber nur so nützlich, wie
die Tests eben laufen — siehe oben.

Aktuell eingetragen:

| Route | Zeitplan |
|---|---|
| `/api/cron/send-emails` | `0 7 * * *` |
| `/api/cron/apple-kalender` | `0 12 * * *` |

### Neue Umgebungsvariablen greifen nicht rückwirkend

Eine Variable, die du in Vercel unter *Settings → Environment Variables*
einträgst, gilt erst für das **nächste** Deployment. Wenn du nur die Variable
setzt und sonst nichts pushst, ändert sich nichts. Dann brauchst du einen
Redeploy.

---

## Wenn etwas live kaputt ist

Der schnellste Weg zurück führt nicht über einen Fix, sondern über Vercel:

*Deployments → das letzte funktionierende auswählen → **Promote to Production***

Das ist in Sekunden erledigt und braucht kein Git. Wichtig: Ein Rollback des
Codes rollt die **Datenbank nicht zurück**. Wenn die kaputte Version eine
Migration brauchte, musst du prüfen, ob die alte Version mit dem neuen Schema
noch zurechtkommt. Meist ja — zusätzliche Spalten stören alten Code nicht.
Umbenannte oder gelöschte schon.

---

## Was ich ergänzen würde

In der Reihenfolge, in der es sich lohnt:

**1. Tests bei jedem Push laufen lassen.** Eine Datei
`.github/workflows/pruefung.yml`, rund zwanzig Zeilen, die `tsc`, `eslint` und
`vitest` startet. Kostet auf öffentlichen wie privaten Repos in deinem Umfang
nichts und schliesst die grösste Lücke: Du erfährst innerhalb einer Minute nach
dem Push, ob etwas gebrochen ist, statt es beim nächsten Mal selbst zu
bemerken.

**2. `main` schützen.** In GitHub unter *Settings → Branches* so einstellen,
dass nur gemergt werden kann, wenn die Prüfung grün ist. Ohne Schritt 1
sinnlos, mit Schritt 1 der eigentliche Nutzen — sonst ist der rote Haken bloss
eine Notiz, die man wegklicken kann.

**3. Migrationen in denselben Ablauf holen.** Entweder über die Supabase-CLI im
Workflow oder wenigstens als Prüfung, die anschlägt, wenn eine Migrationsdatei
im Commit steckt und dich ans Anwenden erinnert.

Punkt 1 ist der einzige mit einem deutlich besseren Verhältnis von Aufwand zu
Nutzen als alles andere. Zwei und drei sind Feinschliff.
