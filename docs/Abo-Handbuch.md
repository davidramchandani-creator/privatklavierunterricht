# Abo-Modell — wie es funktioniert

Stand: 10.08.2026. Ersetzt das Lektionspaket-Modell vollständig.
Beschreibt, was der Schüler sieht, was du siehst und welche E-Mail wann rausgeht.

---

## 1. Die Idee in drei Sätzen

Der Schüler kauft eine **Laufzeit**, nicht eine Lektionszahl, und zahlt
monatlich. Wie viele Lektionen darin liegen, ergibt sich aus seinem Rhythmus
und der Ferienlage — und wird beim Kauf für seinen konkreten Termin exakt
ausgerechnet. Für dich heisst das: planbare Einnahmen, eine stabile Route und
ein Schülerstamm, der nicht alle paar Monate neu entscheidet.

---

## 2. Die vier Varianten

| Abo | Laufzeit | Rhythmus | Lektionen* | Preis/Lektion | **pro Monat** |
|---|---|---|---|---|---|
| Halbjahr | 6 Monate | wöchentlich | 20 | CHF 70 | **CHF 233.35** |
| Halbjahr | 6 Monate | alle 2 Wochen | 10 | CHF 70 | **CHF 116.65** |
| Jahr | 12 Monate | wöchentlich | 39 | CHF 65 | **CHF 211.25** |
| Jahr | 12 Monate | alle 2 Wochen | 20 | CHF 65 | **CHF 108.35** |

\* Beispielwerte für einen Dienstagstermin ab 01.10.2026. Die echte Zahl hängt
vom Wochentag und der Periode ab und wird bei jedem Kauf neu gerechnet.

**Die Laufzeit ist die Laufzeit, der Rhythmus bestimmt die Menge.** Ein
Halbjahresabo dauert immer 6 Monate. Wer wöchentlich kommt, bekommt doppelt so
viele Lektionen wie der zweiwöchentliche und zahlt doppelt so viel.

Das Jahresabo ist pro Lektion CHF 5 günstiger — der Gegenwert dafür, dass sich
jemand ein Jahr bindet. Ohne diesen Unterschied gäbe es keinen Grund, es zu
wählen.

**Flex kostet 15 % Aufschlag.** Wer statt eines Fixplatzes jede Lektion selbst
aussuchen will, zahlt beim Halbjahr wöchentlich CHF 268.35 statt 233.35 — über
die Periode CHF 210 mehr. Grund: wechselnde Termine zerstören die
Routenplanung und erzeugen laufenden Verwaltungsaufwand.

---

## 3. Warum nur Halbjahr und Jahr

Quartalsabos wären naheliegend, funktionieren aber nicht sauber. Nach Zürcher
Schulferien gerechnet:

| Quartal | wöchentlich | zweiwöchentlich |
|---|---|---|
| Okt–Dez | 9 | 5 |
| Jan–Mär | 11 | 6 |
| Apr–Jun | 11 | 6 |
| Jul–Sep (Sommer) | **8** | **4** |

Im Sommerquartal bekäme jemand für denselben Preis 8 Lektionen, im Frühling 11.
Ein Drittel Unterschied — das fällt auf und müsste jedes Mal erklärt werden.

Halbjahre gleichen sich dagegen fast perfekt aus: 20 im Winterhalbjahr, 19 im
Sommerhalbjahr. Übers ganze Jahr sind es 39 wöchentliche Lektionen.

---

## 4. Ferien sind eingerechnet, nicht verrechnet

Das ist der Punkt, der die meiste Verwirrung vermeidet — wenn er klar
kommuniziert wird.

Beim alten Modell hatte der Schüler 10 Lektionen gekauft und musste sie
kriegen; jede Ferienwoche verlängerte die Laufzeit. Beim Abo ist es umgekehrt:
Du versprichst 20 Lektionen im Halbjahr, **weil** in einem Halbjahr nach
Ferienabzug 20 reinpassen.

Daraus folgt:

- Schulferien lösen **keine** Laufzeitverlängerung mehr aus.
- Es gibt dafür weder Ersatz noch Rückerstattung — sie wurden nie berechnet.
- Die Ausfall-Kaskade greift nur noch bei **einzelnen** Absagen.

Der Schüler bestätigt das beim Kauf als eigenen Punkt, und in der
Bestätigungsmail stehen die konkreten Ferientermine mit dem Zusatz „bereits
eingerechnet — du zahlst nichts dafür".

Die Ferienzeiträume pflegst du unter **Admin → Kalender → Schulferien**.
Änderungen wirken nur auf **neue** Abos; bereits verkaufte behalten ihre
zugesicherte Lektionszahl.

---

## 5. Was der Schüler beim Kauf sieht

Drei Schritte, jeder mit Erklärkasten:

1. **Rhythmus** — jede Woche oder alle zwei Wochen
2. **Buchungsart** — Fixplatz oder Flex, mit dem Aufpreis in Franken
3. **Fester Termin** — nur Plätze, die über die **ganze Laufzeit** frei sind

Danach die Übersicht mit dem Monatsbetrag gross und seinen echten Terminen:

> Halbjahresabo · 01.10.2026 – 31.03.2027 · 20 Lektionen · jeden Dienstag 17:15
> **CHF 233.35 pro Monat**
> In den Ferien kein Unterricht: 06.10., 13.10., 22.12., 29.12., 09.02., 16.02.
> — bereits abgezogen, du zahlst nichts dafür

**Fünf Punkte einzeln bestätigen.** Ein Sammelhäkchen liest niemand:

1. **Laufzeit** — von wann bis wann, wie viele Lektionen
2. **Ferien sind eingerechnet** — kein Ersatz, keine Rückerstattung
3. **Wenn ich nicht kann** — 24-Stunden-Regel und Ausweichkaskade
4. **Monatliche Zahlung** — Betrag jeden Monat gleich, unabhängig von der
   Lektionszahl in diesem Monat
5. **AGB**

Erst wenn alle fünf gesetzt sind, wird der Knopf aktiv.

---

## 6. Was beim Abschluss passiert

1. Abo wird angelegt (Variante, Rhythmus, Fixplatz, Periode)
2. Monatsraten angelegt — **keine Anzahlung**, jeder Monat gleich viel
3. Die ganze Terminserie wird gebucht
4. E-Mails gehen raus

| Mail | An |
|---|---|
| `abo_gestartet` | Schüler — alle Termine, Ferien, Monatsbetrag |
| `abo_gestartet_admin` | Du |

Die Monatsrechnungen stellt der Cron am jeweiligen Stichtag, über denselben
Weg wie bisher (Rechnung → „Ich habe bezahlt" → du bestätigst).

---

## 7. Wenn jemand nicht kann

Unverändert zum Fixplatz-Modell:

1. Ausweichtermin in derselben Woche
2. Ausweichtermin in der Folgewoche
3. Laufzeitgutschrift
4. Rückerstattung — nur von Hand

| Fall | Lektion erhalten? |
|---|---|
| Schüler, mehr als 24 h vorher | ja |
| Schüler, weniger als 24 h vorher | **nein** |
| Du, egal wie kurzfristig | ja |

**Schulferien fallen nicht darunter** — sie sind eingerechnet und lösen nichts
aus.

---

## 8. Verlängerung

Läuft die Periode ab und die Verlängerung ist an, startet die nächste
automatisch — **mit demselben Rhythmus, derselben Buchungsart und demselben
Fixplatz**. Die neue Terminserie wird direkt gebucht.

**Alles wird neu gerechnet.** In einem Winterhalbjahr liegen andere Ferien als
in einem Sommerhalbjahr:

| Periode | Lektionen | pro Monat |
|---|---|---|
| 01.10.2026 – 31.03.2027 | 20 | CHF 233.35 |
| 01.04.2027 – 30.09.2027 | 19 | CHF 221.65 |
| 01.10.2027 – 31.03.2028 | 22 | CHF 256.65 |

Der Preis **pro Lektion** bleibt immer gleich — nur die Menge schwankt. Die
Verlängerungsmail benennt das offen, statt es in einer geänderten Zahl zu
verstecken.

Kündbar bis **30 Tage** vor Periodenende, im Portal per Schalter.

---

## 9. Vorzeitiger Ausstieg

Der Normalfall ist die Kündigung: Verlängerung abschalten, Periode zu Ende
laufen lassen. Der vorzeitige Ausstieg (Admin-Aktion) ist für den echten
Ausnahmefall — Wegzug, längere Krankheit, Kulanz.

**Regel: angefangene Monate sind geschuldet.** Wer am 10. März aussteigt, zahlt
den März. In diesem Monat hat Unterricht stattgefunden und der Platz war
reserviert. Die Monate danach entfallen.

Bewusst nicht nach bezogenen Lektionen gerechnet: Sonst wäre der Ausstieg im
Dezember (wenige Lektionen wegen Ferien) günstiger als im März, obwohl der
Platz gleich lang blockiert war.

Beispiel Halbjahresabo CHF 233.35/Monat, Ausstieg am 20.01.:

| | |
|---|---|
| Angefangene Monate | 4 von 6 |
| Geschuldet | CHF 933.40 |
| Bereits bezahlt | CHF 933.40 |
| Offen | CHF 0.00 |

Zukünftige Termine werden abgesagt, noch nicht gestellte Raten der offenen
Monate geschlossen. Bereits gestellte Rechnungen bleiben unangetastet.

---

## 10. Was du im Admin tust

**Abo anlegen** (Schülerdetail → Abo anlegen): Variante, Rhythmus,
Buchungsart, dann „Freie Termine suchen". Die Vorschau zeigt dieselbe
Lektionszahl und denselben Monatsbetrag, die der Schüler beim Selbstabschluss
sähe — bewusst über dieselbe Rechnung, damit es keine stillen Abweichungen
gibt.

**Schulferien** (Kalender → Schulferien): Zeiträume anlegen und löschen.

**Routenplanung** (Kalender → Routenplanung): siehe Fixplatz-Handbuch.

---

## 11. Was noch offen ist

- **Bestandsschüler**: laufen ihre alten Pakete zu Ende und wechseln danach.
  Ein Migrationsweg ist noch nicht gebaut.
- **AGB-Text**: die fünf Bestätigungspunkte entsprechen dem Modell, die AGB
  selbst sind noch auf dem alten Stand.
- **Ausweichtermin-Auswahl im Portal**: die Vorschläge stehen in der E-Mail;
  die Auswahl direkt im Portal fehlt noch.
- **Preisseite der Website**: zeigt noch die alten Pakete.
- **Der Build läuft in meiner Umgebung nicht** (Next.js stürzt dort im nativen
  Binary ab). Geprüft ist alles über TypeScript, ESLint und 247 Tests — der
  echte Build passiert auf Vercel.
