# Fixplatz-Modell — wie es funktioniert

Stand: 10.08.2026. Beschreibt, was der Schüler sieht, was du siehst und welche
E-Mail wann rausgeht.

---

## 1. Die Idee in drei Sätzen

Du fährst zu den Schülern. Deine knappe Ressource ist damit nicht die Lektion,
sondern der ganze Abend inklusive Fahrweg. Ein **Fixplatz** — fester Wochentag,
feste Uhrzeit, alle Termine im Voraus gebucht — macht die Route für Monate
planbar und spart Fahr- und Verwaltungszeit. Wer trotzdem frei buchen will,
kann das: **Flex** kostet 10 % Aufschlag, weil genau diese Freiheit die
Planbarkeit zerstört.

---

## 2. Rhythmus bestimmt die Laufzeit

Beim Kauf wählt der Schüler (oder du im Erstgespräch), wie oft er kommt. Danach
richtet sich die Gültigkeit:

| Paket | wöchentlich | alle zwei Wochen |
|---|---|---|
| 10er | 4 Monate | 6 Monate |
| 20er | 8 Monate | 12 Monate |

Dahinter steckt eine einzige Regel: **0.4 Monate pro Lektion wöchentlich,
0.6 zweiwöchentlich.** Das ist kein Zufall, sondern bewusst so gewählt — dadurch
lässt sich ein Rhythmuswechsel mitten im Paket ohne Sonderfälle umrechnen
(siehe Abschnitt 7).

Der Preis ändert sich durch den Rhythmus **nie**. Gleiche Lektionszahl, gleicher
Lektionspreis. Der Rhythmus bestimmt nur, über welchen Zeitraum die Lektionen
bezogen werden — und bei Ratenzahlung, auf wie viele Raten sich derselbe Betrag
verteilt.

### Die Raten folgen dem Unterricht, nicht der Laufzeit

Das ist wichtig und nicht selbstverständlich. Die **Laufzeit** ist grosszügig
(4 Monate für 10 wöchentliche Lektionen), weil sie Puffer für Ferien und
Krankheit enthält. Die **Lektionen** selbst sind aber schon nach gut 2 Monaten
durch.

Wären die Raten an die Laufzeit gekoppelt, liefen sie zwei Monate weiter, ohne
dass Unterricht stattfindet — und wenn dann ein neues Paket startet, hätte der
Schüler zwei Zahlungspläne gleichzeitig. Darum enden die Raten mit dem
Unterricht:

| Paket | Lektionen durch nach | Anzahlung | Raten | letzte Rate |
|---|---|---|---|---|
| 10er wöchentlich | 2.1 Mt | CHF 175 | 2 × CHF 262.50 | 09.10. |
| 10er alle zwei Wochen | 4.2 Mt | CHF 175 | 4 × CHF 131.25 | 09.12. |
| 20er wöchentlich | 4.4 Mt | CHF 325 | 4 × CHF 243.75 | 09.12. |
| 20er alle zwei Wochen | 8.7 Mt | CHF 325 | 9 × CHF 108.35 | 09.05. |

Der Nachteil, damit du ihn kennst: die einzelnen Raten sind grösser. Beim 10er
wöchentlich verdoppelt sich die Rate von CHF 131.25 auf CHF 262.50. Beides ist
nicht gleichzeitig zu haben — entweder kleine Raten oder eine Zahlung, die mit
dem Unterricht endet. Das Ablaufdatum bleibt in jedem Fall unverändert, der
Puffer für Ferien und Krankheit geht also nicht verloren.

---

## 3. Was der Schüler beim Kauf sieht

Vier Schritte, jeder mit einem Erklärkasten. Kein Schritt lässt sich
überspringen.

**Schritt 1 — Rhythmus.** Zwei Kacheln, jede mit der konkreten Laufzeit und dem
konkreten Ablaufdatum („Gültig bis 09.12.2026"). Dazu der Hinweis, dass der
Preis in beiden Fällen identisch ist.

**Schritt 2 — Buchungsart.** Fixplatz gegen Flex, mit beiden Preisen
nebeneinander und dem Gesamtaufpreis in Franken ausgeschrieben — nicht nur
„+10 %". Erklärt wird auch der Grund: wechselnde Termine bringen die Fahrtrouten
durcheinander.

**Schritt 3 — fester Termin** (nur bei Fixplatz). Hier steht die eigentliche
Arbeit: Angeboten werden **nur Termine, die über die ganze Laufzeit frei sind**,
nicht bloss nächste Woche. Jeder Vorschlag zeigt, wie viele der geplanten
Termine auf Anhieb passen und wie viele einen Ausweichtermin brauchen.

**Schritt 4 — Zahlung.** Einmalig oder Monatsraten, mit vollständigem
Zahlungsplan. Dazu die Auto-Verlängerung als Häkchen.

**Zum Schluss — vier Punkte einzeln bestätigen.** Ein Sammelhäkchen liest
niemand, darum sind es vier getrennte:

1. **Laufzeit und Verfall** — bis wann die Lektionen zu beziehen sind
2. **Wenn ich einmal nicht kann** — die 24-Stunden-Regel und die Ausweichkaskade
3. **Zahlung** — bei Raten explizit: der Gesamtbetrag ist unabhängig davon
   geschuldet, wie viele Lektionen tatsächlich bezogen werden
4. **AGB**

Erst wenn alle vier gesetzt sind, wird der Kauf-Knopf aktiv.

---

## 4. Was beim Kauf passiert

1. Paket wird angelegt (Rhythmus, Laufzeit, Fixplatz gespeichert)
2. Rechnung: Gesamtbetrag oder Anzahlung
3. **Die ganze Terminserie wird gebucht** — 10 bzw. 20 Termine auf einmal
4. Termine, die auf Ferien oder einen Feiertag fallen, bekommen automatisch
   einen Ausweichtermin (gleiche Woche, sonst Folgewoche)
5. E-Mails gehen raus

Wichtig: Ein einzelner belegter Termin **bricht die Serie nicht ab**. Über 4 bis
12 Monate liegt fast immer mal eine Ferienwoche im Weg — ein
Alles-oder-nichts würde bedeuten, dass praktisch nie ein Fixplatz zustande käme.

Bei Ratenzahlung wird die Serie trotzdem sofort gebucht. Den Platz bis zum
Zahlungseingang freizulassen hiesse, ihn an jemand anderen zu verlieren. Die
Buchungssperre bei offener Anzahlung greift nur für *zusätzliche* Termine.

### E-Mails beim Kauf

| Mail | An | Inhalt |
|---|---|---|
| `fixplatz_confirmed` | Schüler | Alle Termine aufgelistet, Ausweichtermine ausgewiesen |
| `fixplatz_admin` | Du | Wer, welcher Platz, wie viele Termine |
| `package_created` | Schüler | Paketbestätigung, Zahlungsplan |
| `package_purchased_admin` | Du | Kaufmeldung |
| `qr_invoice` / `twint_payment_request` | Schüler | Rechnung |

---

## 5. Wenn jemand nicht kann

Die Kaskade, in dieser Reihenfolge:

1. **Ausweichtermin in derselben Woche**
2. **Ausweichtermin in der Folgewoche**
3. **Laufzeitgutschrift** — das Paket läuft um ein Rhythmusintervall länger
   (7 Tage wöchentlich, 14 zweiwöchentlich)
4. **Rückerstattung** — nur von Hand, nie automatisch

Warum diese Reihenfolge: Jede Stufe kostet dich mehr als die vorige. Ein
Ausweichtermin kostet nichts (die Lücke war ohnehin da), eine Gutschrift kostet
nur später Geld, eine Rückerstattung kostet echtes Geld. Die für den Schüler
fairste Reihenfolge ist damit zugleich die für dich günstigste.

### Die Ausweichvorschläge

Vorgeschlagen werden zuerst Termine zur **gewohnten Uhrzeit an anderen
Wochentagen**, erst danach andere Uhrzeiten. Die gewohnte Zeit ist für Schüler
meist das Verbindlichere als der Wochentag. Höchstens zwei Vorschläge pro Tag,
damit die Auswahl über mehrere Tage streut.

### Wer absagt, macht den Unterschied

| Fall | Lektion erhalten? | Mail an Schüler |
|---|---|---|
| Schüler, mehr als 24 h vorher | ja | `ausfall_ersatz_vorschlag` |
| Schüler, weniger als 24 h vorher | **nein** | `ausfall_kurzfristig` |
| Du, egal wie kurzfristig | ja | `ausfall_ersatz_vorschlag` |

Bei dir gibt es die 24-Stunden-Ausnahme bewusst **nicht**. Du bist der
Verursacher und schuldest immer einen Ausgleich.

Findet sich kein einziger Ausweichtermin, greift sofort Stufe 3 und der Schüler
bekommt `ausfall_gutschrift` — mit dem neuen Ablaufdatum darin. Läuft das Paket
gerade pausiert, wächst die eingefrorene Restzeit statt des Ablaufdatums, sonst
ginge die Gutschrift beim Fortsetzen verloren.

Du bekommst in jedem Fall `ausfall_admin`.

---

## 5b. Wenn jemand früher fertig ist als die Laufzeit

Der häufigste Fall überhaupt — und der, an dem am meisten schiefgehen kann.

**Ausgangslage:** 10er wöchentlich, gekauft am 09.08. Die letzte Lektion ist am
13.10., die Laufzeit läuft aber bis 09.12. Dazwischen liegen 57 Tage.

**Was passiert:** Eine Woche nach der letzten Lektion wird das Paket
geschlossen. Nicht am Ablaufdatum — das wären fast zwei Monate, in denen der
Schüler weder buchen noch ein neues Paket kaufen kann (die Datenbank lässt nur
ein aktives Paket zu) und die Verlängerung noch nicht greift. Eine erzwungene
Pause, die niemand bestellt hat.

Die Woche Puffer ist Absicht: In dieser Zeit kann noch ein Ausweichtermin oder
eine Verschiebung hereinkommen.

**Bei aktiver Auto-Verlängerung:** Das neue Paket startet sofort, mit
**demselben Rhythmus und demselben Fixplatz**. Wer dienstags um 17:15 hatte, hat
weiterhin dienstags um 17:15 — die neue Terminserie wird direkt gebucht. Ein
Verlängerungspaket, das stillschweigend auf wöchentlich und flexibel
zurückfällt, wäre eine andere Leistung als die gekaufte.

**Ohne Auto-Verlängerung:** Das Paket wird geschlossen, der Schüler kann sofort
ein neues kaufen. Kein Warten aufs Ablaufdatum.

**Und das Geld?** Weil die Raten dem Unterricht folgen (Abschnitt 2), ist bei
drei der vier Paketvarianten beim Abschluss **nichts mehr offen**. Nur beim
20er zweiwöchentlich bleibt typischerweise eine letzte Rate übrig.

Falls doch etwas offen ist, wird es zu **einer einzigen Schlussrechnung**
zusammengezogen, fällig sofort. Nie zwei Zahlungspläne nebeneinander. Der Betrag
ist sauber geschuldet — bezahlt wird das Paket, nicht die einzelne Lektion. Es
geht allein um die Übersicht.

Bereits gestellte Rechnungen werden dabei nicht angefasst.

---

## 6. Was du im Admin tust

**Paket anlegen** (Schülerdetail → Neues Paket): dieselben Felder wie im Portal
— Rhythmus, Buchungsart, und bei Fixplatz ein Knopf „Freie Termine suchen". Die
Suche prüft dieselbe Serie über dieselbe Laufzeit wie im Portal. Ohne
ausgewählten Termin lässt sich ein Fixplatz-Paket nicht anlegen.

Anders als im Portal setzt du den Preis von Hand — deshalb wird bei dir **kein**
automatischer Flex-Aufschlag draufgerechnet. Wenn du ihn willst, tippst du ihn
in den Preis.

**Rhythmus wechseln**: Server-Action `rhythmusWechseln`. Rechnet die
Restlaufzeit um, verteilt offene Raten neu und schickt `rhythmus_changed`.

**Routenplanung** (eigener Menüpunkt unter Kalender): siehe nächster Abschnitt.

---

## 7. Rhythmuswechsel mitten im Paket

Funktioniert in **beide** Richtungen. Die Restlaufzeit richtet sich nach den
**verbleibenden Lektionen**, nicht nach dem Wechselzeitpunkt und nicht nach der
ursprünglichen Laufzeit.

Beispiel 10er, gekauft wöchentlich (Ablauf 09.12.), Wechsel am 09.10. auf
zweiwöchentlich:

| Restlektionen | neues Ablaufdatum | Differenz |
|---|---|---|
| 10 | 09.04.2027 | +121 Tage |
| 7 | 15.02.2027 | +68 Tage |
| 4 | 21.12.2026 | +12 Tage |
| 2 | 09.12.2026 | ±0 (geschützt) |

Das macht den Wechsel unausnutzbar: Wer kurz vor Ablauf auf zweiwöchentlich
wechselt, um Zeit zu gewinnen, bekommt nur die Zeit, die seine Restlektionen
wirklich brauchen — nicht pauschal zwei Monate.

Umgekehrt (zweiwöchentlich → wöchentlich) verkürzt sich die Laufzeit
entsprechend. Das ist gewollt: es ist der Gegenwert dafür, dass man den
schnelleren Rhythmus wählt.

**Ein Schutz ist eingebaut:** Der Wechsel auf den *langsameren* Rhythmus nimmt
nie Zeit weg. Ohne diese Regel würde jemand mit einer Restlektion durch den
Wechsel auf zweiwöchentlich 43 Tage *verlieren* — obwohl er ja gerade mehr Zeit
will.

**Beim Geld ändert sich nichts.** Der Gesamtpreis bleibt. Bereits gestellte
Rechnungen werden nicht angefasst — eine Rechnung, die draussen ist, schreibt
man nicht um. Nur die noch nicht fakturierten Raten werden über die neue
Restlaufzeit gestreckt oder gestaucht. Wird die Laufzeit kürzer als die Zahl der
offenen Raten, werden Raten zusammengelegt (weniger, dafür grössere). Länger
werdende Laufzeit erzeugt **nie mehr** Raten als vereinbart — das wäre eine
stille Vertragsänderung.

---

## 8. Der Routenplaner

Admin → Kalender → Routenplanung.

### Was er macht

Verteilt die Schüler auf Wochentage und Uhrzeiten, sodass möglichst wenig
Fahrzeit anfällt. Es wird **nichts gebucht und nichts verändert** — das Ergebnis
ist ein Vorschlag zum Anschauen.

### Drei Dinge, die er anders macht als erwartet

**Er gruppiert nach Fahrtrichtung, nicht nach Nähe.** Das klingt nach einer
Feinheit, ist aber der Unterschied zwischen brauchbar und unbrauchbar. Beispiel
aus der Testrechnung: Elgg liegt weit weg und hat keinen nahen Nachbarn. Nach
Nähe gruppiert bekommt Elgg einen eigenen Abend — eine Stunde Fahrt für eine
Lektion. Tatsächlich liegt Elgg aber in derselben Richtung wie Wiesendangen und
Rickenbach; man fährt ohnehin daran vorbei. Nach Richtung gruppiert landen die
drei am selben Abend.

**Zwei zweiwöchentliche Schüler teilen sich einen Platz** — der eine in geraden,
der andere in ungeraden Kalenderwochen. So trägt ein Platz zwei Schüler statt
anderthalb. Gepaart wird nur, wer höchstens 4 km auseinander wohnt: der Plan
rechnet eine geteilte Position mit dem Mittelpunkt beider Adressen, und bei
7 km Abstand läge der dort, wo niemand wohnt.

**Er rechnet durch, wie viele Unterrichtstage sich lohnen.** Das ist die
eigentliche unternehmerische Frage. Jeder zusätzliche Tag bringt einen eigenen
Hin- und Rückweg mit — dieselben Lektionen auf weniger Abende gelegt kosten
weniger Fahrzeit bei identischem Umsatz.

### Beispielrechnung

16 Schüler im Raum Winterthur/Neftenbach, davon 5 zweiwöchentlich:

| Tage | Wochentage | Lekt./Wo. | Fahrzeit/Wo. | je Lektion | ohne Platz |
|---|---|---|---|---|---|
| 2 | Mo Di | 6.5 | 1 Std. 30 | 14 Min. | 14 |
| 3 | Mo Di Mi | 10 | 2 Std. 55 | 17 Min. | 7 |
| **4** | **Mo Di Mi Do** | **13.5** | **3 Std. 37** | **16 Min.** | **0** |
| 5 | Mo Di Mi Do Fr | 13.5 | 4 Std. 36 | 20 Min. | 0 |

Vier Tage schlagen fünf um **59 Minuten pro Woche** — bei exakt derselben
Lektionszahl und damit demselben Umsatz. Auf 46 Unterrichtswochen sind das
**45 Stunden im Jahr**, plus ein freier Wochentag.

Diese Zahlen stammen aus einer Modellrechnung mit erfundenen Adressen. Mit
deinen echten Schülern sehen sie anders aus — der Planer rechnet sie dir aus.

### Adressen

Der Planer braucht Koordinaten. Beim ersten Mal drückst du „Adressen auflösen" —
das fragt den amtlichen Schweizer Geodienst (kostenlos, kein Schlüssel nötig)
und speichert das Ergebnis. Dauert etwa eine Sekunde pro Schüler und passiert
nur einmal; erst wenn jemand umzieht, wird neu aufgelöst.

Schüler ohne auflösbare Adresse werden **sichtbar gemeldet**, nicht still
weggelassen. Sonst fehlt jemand im Plan und niemand merkt es.

### Fahrzeiten

Standardmässig geschätzt: Luftlinie × 1.35 Umwegfaktor bei 45 km/h, plus
3 Minuten fix pro Fahrt (Auto holen, parkieren, zur Haustür). Ohne diesen
Fixaufschlag wirken kurze Wege gratis und der Planer stapelt Schüler
unrealistisch dicht.

Für die Region reicht das, um Routen sinnvoll zu ordnen. Wo du es besser weisst,
lässt sich eine Fahrzeit von Hand hinterlegen — manuelle Werte schlagen jede
Schätzung.

### Warnungen

Der Planer meldet von sich aus, wenn ein Tag mehr Fahrzeit als Unterricht
kostet, oder wenn ein einzelner Schüler an einem eigenen Tag über 45 Minuten
Fahrt verursacht. Solche Tage tragen sich nicht — entweder kommt ein zweiter
Schüler in der Nähe dazu, oder es braucht einen Wegaufschlag.

---

## 9. Was noch offen ist

- **Bestandsschüler**: wechseln die auf Fixplatz, oder starten nur neue damit?
- **Flex-Aufschlag**: aktuell 10 %, frei änderbar in `rhythmus.ts`
  (`FLEX_SURCHARGE_PERCENT`).
- **AGB-Text**: die vier Bestätigungspunkte beim Kauf entsprechen dem Modell,
  die AGB selbst sind noch auf dem alten Stand.
- **Ausweichtermin-Auswahl im Portal**: die Vorschläge stehen in der E-Mail; die
  Auswahl direkt im Portal ist noch nicht gebaut.
- **Plan anwenden**: der Routenplaner zeigt und speichert Pläne, wandelt sie
  aber noch nicht per Knopfdruck in Fixplätze um.
- **Der Build läuft in meiner Umgebung nicht** (Next.js stürzt dort im nativen
  Binary ab). Geprüft ist alles über TypeScript, ESLint und 215 Tests — der
  echte Build passiert auf Vercel.
