# Testen, ohne dass ein Schüler etwas merkt

Kurz: **erst die Mail-Umleitung setzen, dann Testschüler anlegen, dann einen
Probelauf fahren, zum Schluss alles entfernen.**

---

## Warum es überhaupt eine Vorkehrung braucht

Zwei Stellen richten beim Ausprobieren echten Schaden an:

| Aktion | Was ohne Vorkehrung passiert |
|---|---|
| „Runde starten“ | Alle 7 echten Schüler bekommen sofort eine echte Mail. |
| „Zuteilung anwenden“ | Bestehende Termine werden abgesagt, neue gebucht, Google-Kalender aktualisiert. |

Termine lassen sich zurückdrehen. Eine verschickte Mail nicht.

---

## Schritt 1: Mail-Umleitung einschalten

In Vercel unter *Settings → Environment Variables*:

```
EMAIL_REDIRECT_TO = d.ramchandani@bluewin.ch
```

Danach neu deployen (oder Redeploy auslösen), damit sie greift.

Was sie tut: **jede** Mail geht an dich statt an den Schüler. Betreff wird zu
`[TEST → anna@example.ch] Dein Termin steht`, und oben in der Mail steht ein
gelber Streifen mit dem echten Empfänger. Das gilt für alles — Runden,
Einzelanfragen, Rechnungen, Zahlungserinnerungen, auch für geplante Mails, die
später aus der Warteschlange laufen.

Die Umleitung sitzt zuunterst im Versand, an der einen Stelle, durch die jede
Mail muss. Es gibt keinen Weg daran vorbei, auch nicht für Mailfunktionen, die
später dazukommen.

Solange sie aktiv ist, steht auf **jeder** Admin-Seite ein gelber Streifen.
Das ist Absicht: ein Testmodus, den man still anlassen kann, ist gefährlicher
als gar keiner — wenn die Variable stehen bleibt, bekommt nie wieder ein
Schüler eine Mail, und es fällt niemandem auf, weil nichts kaputtgeht.

---

## Schritt 2: Testschüler anlegen

**Admin → Testmodus → „Testschüler anlegen“.**

Ohne gesetzte Umleitung ist der Knopf gesperrt und die Aktion weist ab. Das
ist die zweite Sicherung.

Es entstehen fünf Schüler mit echten Adressen aus deiner Gegend, jeder mit
aktivem Abo und hinterlegten Zeiten. Sie sind **keine Attrappen**, sondern
normale Schüler mit einem Merker — nur so testest du den Ablauf, den du später
wirklich fährst.

| Wer | Wo | Wofür der Fall da ist |
|---|---|---|
| Anna | Aesch | Direkt nebenan — muss praktisch gratis sein. |
| Bruno | Pfungen | Südwestlich, auf dem Weg nach Winterthur. |
| Clara | Winterthur | Gleiche Richtung wie Bruno; prüft die Gruppierung nach Fahrtrichtung. |
| David | Elsau | Östlich. Darf **nicht** mit Pfungen zusammenfallen, obwohl die Luftlinie kurz ist. |
| Elena | Kleinandelfingen | Weit im Norden — der teure Aussenposten. |

Clara und Elena können nur an je einem Tag. Das ist Absicht: wenn alle immer
können, ist jede Zuteilung richtig und der Test sagt nichts aus.

---

## Schritt 3: Probelauf

**Admin → Kalender → Terminplanung → Runde starten**, Häkchen bei
**„Probelauf — nur Testschüler anschreiben“**.

Die Beschränkung gilt nicht nur für die Mails, sondern für die ganze Runde:
Antwortstand, Zuteilungsrechnung und Anwenden arbeiten ausschliesslich mit
Testschülern. Ein Probelauf kann deine echten Schüler nicht umbuchen. Umgekehrt
lässt eine echte Runde die Testschüler aus, damit sie die Zuteilung nicht
verfälschen.

Dann der Reihe nach:

1. **Zuteilung rechnen.** Die Zeiten der fünf sind schon hinterlegt, du musst
   nichts eintragen. Schau dir an, wer welchen Platz bekommt und was die
   Fahrzeit pro Woche ist.
2. **Prüfen, ob es plausibel ist.** Landen Bruno und Clara auf demselben
   Abend? Bekommen Clara und Elena ihren einzigen möglichen Tag? Liegt Elena
   allein an einem Abend, und was kostet das?
3. **Anwenden.** Jetzt werden Termine gebucht und die Mails geschrieben — bei
   dir im Postfach, fünf Stück, jede mit dem echten Empfänger im Betreff.
4. **Routenplanung ansehen.** Reihenfolge pro Abend, Fahrzeiten, „Route
   öffnen“ in Google Maps.
5. **Einpassen ausprobieren:** einen Testschüler unter Testmodus entfernen und
   über „Einzelnen Schüler einpassen“ wieder hineinsetzen — so siehst du den
   Fall, der zwischen zwei Runden auftritt.

---

## Schritt 4: Aufräumen

**Admin → Testmodus → „Alle Testdaten entfernen“.** Entfernt die fünf samt
Terminen, Abos, Raten, Rechnungen, Verfügbarkeiten, Probelauf-Runden und
Anmeldekonto. Echte Schüler bleiben unberührt.

Danach **EMAIL_REDIRECT_TO in Vercel wieder löschen** und neu deployen. Erst
wenn der gelbe Streifen im Admin verschwunden ist, gehen Mails wieder an
Schüler.

---

## Test und Ernst bleiben getrennt

Nicht nur bei den Mails. Solange Testschüler existieren, rechnet **jede**
Auswertung entweder mit den einen oder mit den anderen — nie mit beiden.

| Wo | Was gilt |
|---|---|
| Routenplanung | Umschalter oben: Testschüler oder echte. Vorgabe ist die Testsicht, solange Testschüler da sind. |
| Terminplanung, Runde | Ein Probelauf betrifft nur Testschüler, eine echte Runde nur echte. |
| Einzelnen einpassen | Auswahl und Vergleichsplan folgen demselben Kreis. |
| Abwesenheiten | Auswahlliste folgt dem, woran gerade gearbeitet wird. |
| Dashboard | Zählt immer nur echte Schüler — die Kennzahlen sollen die Wirklichkeit zeigen. |
| Adressen auflösen | Gilt bewusst für alle: Testadressen brauchen genauso Koordinaten. |

Der Grund ist nicht Ordnungsliebe. Eine Route über fünf erfundene und sieben
echte Adressen ergibt Fahrzeiten, Gruppen und Empfehlungen, die für keinen der
beiden Fälle stimmen — und das Ergebnis sieht dabei völlig plausibel aus. Das
ist die unangenehmste Sorte Fehler.

Ein Test im Projekt wacht darüber: Wer künftig eine Auswertung über Schüler
baut und den Kreis nicht angibt, bekommt einen roten Testlauf statt eines
stillen Mischergebnisses.

---

## Was der Probelauf nicht abdeckt

- **Der Weg des Schülers durchs Portal.** Die Testschüler haben ihre Zeiten
  schon hinterlegt; niemand trägt sie über die Oberfläche ein. Wenn du das
  sehen willst, melde dich als Testschüler an — Passwort über „Passwort
  vergessen“ setzen, die Mail landet ja bei dir.
- **Der Google-Kalender.** Beim Anwenden entstehen echte Kalendereinträge.
  Beim Entfernen der Testdaten werden die Termine gelöscht; ob der Eintrag im
  Google-Kalender mitverschwindet, hängt am Sync — schau danach einmal nach.
- **Echte Zahlungen.** QR-Rechnungen werden erzeugt, aber nichts wird
  eingezogen.
