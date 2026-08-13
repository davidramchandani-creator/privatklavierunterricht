# Startseite — Gestaltungsspezifikation

Richtung: **hell und luftig, editorial**. Minimalistisch, aber nicht leer.
Ziel jeder Entscheidung auf dieser Seite: **Probelektion buchen**.

---

## 1. Worum es geht

Ein Besucher landet hier, weil er (oder sein Kind) Klavier lernen will. Er
kennt dich nicht. Er will drei Dinge wissen, in dieser Reihenfolge:

1. Kann der was?
2. Passt der zu mir?
3. Was kostet es und wie fange ich an?

Die heutige Seite beantwortet Frage 3 zuerst: Der Preis steht im Hero
(„Im 20er-Paket ab CHF 65"), die Pakete kommen direkt nach dem Hero. Bei einem
Premium-Anspruch ist das zu früh — ein Preis ohne aufgebauten Wert wirkt immer
hoch. Diese Spezifikation dreht die Reihenfolge um.

### Die drei inhaltlichen Änderungen

| | Heute | Neu | Warum |
|---|---|---|---|
| Preis im Hero | „Im 20er-Paket ab CHF 65", zweitprominentestes Element | raus | Verkauft, bevor irgendetwas versprochen wurde |
| Reihenfolge | Hero → Pakete → Preisrechner → … | Hero → **Hörproben** → Vorteile → Über mich → Bewertungen → Pakete → Preisrechner → CTA | Erst Können zeigen, dann Person, dann Beleg, dann Preis |
| Beleg | 4 Textbewertungen | **Hörproben** + Bewertungen | Bei einem Musiklehrer überzeugt Klang mehr als jeder Satz |

---

## 2. Aufbau

```
┌─ Hero ─────────────────────────── volle Höhe, weiss
│  Kicker · Headline · Subtext · CTA · Vertrauens-Pills
│  rechts: Porträt + „Nächster freier Termin"-Karte
├─ Hörproben ────────────────────── surface (#F3F5F8)
│  3–5 Aufnahmen, Wellenform-Player
├─ Vorteile ─────────────────────── weiss
├─ Über mich (Teaser) ──────────── weiss, Porträt + Text
├─ Bewertungen ─────────────────── surface
├─ Pakete ──────────────────────── weiss   ← Preis erscheint hier zum ersten Mal
├─ Preisrechner ────────────────── surface
└─ Probelektion-CTA ────────────── navy-900, volle Breite
```

Der Wechsel weiss / `surface` ist der einzige Trenner. Keine Linien, keine
Rahmen zwischen Abschnitten — das ist der „luftige" Teil.

**Vertikaler Rhythmus:** `py-24` (96px) auf Desktop, `py-16` (64px) mobil.
Ausnahme Hero (`min-h-screen`) und CTA (`py-28`).

**Raster:** `max-w-7xl` (1280px), Innenabstand `px-4 sm:px-6 lg:px-8`.
Fliesstext nie breiter als `max-w-2xl` (672px) — darüber wird Lesen mühsam.

---

## 3. Gestaltungsmarken

Alle vorhanden, nichts Neues nötig. Verwende die Namen, nicht die Werte.

| Marke | Wert | Wofür |
|---|---|---|
| `navy-900` | `#1C244B` | Überschriften, Primärknopf, CTA-Fläche |
| `navy-600` | `#4b57a7` | Kursive Akzentwörter in Überschriften |
| `navy-50` | `#f0f1f8` | Badge-Hintergrund, Wellenform inaktiv |
| `surface` | `#F3F5F8` | Abschnittswechsel |
| `gray-500` | | Fliesstext |
| `gray-400` | | Bildunterschriften, Hilfstexte |
| `amber-400` | | Sterne — die **einzige** Fremdfarbe der Seite |
| `--ease-out-soft` | | Ein- und Ausblendungen |
| `--ease-ios` | | Bewegung mit Richtung |

**Schrift:** Plus Jakarta Sans durchgehend.

| Rolle | Grösse | Gewicht | Zeilenhöhe |
|---|---|---|---|
| Hero-Headline | `text-4xl sm:text-5xl lg:text-6xl` | 800 | 1.1, `tracking-tight` |
| Abschnitts-Headline | `text-3xl sm:text-4xl` | 800 | 1.15, `tracking-tight` |
| Kicker | `text-xs` | 600 | `uppercase tracking-widest` |
| Fliesstext | `text-lg` | 400 | `leading-relaxed` |
| Hilfstext | `text-sm` | 400 | `leading-snug` |

**Ecken:** Knöpfe und Eingaben 12px (`--radius`), Karten 16px, grosse
Bildflächen 24px. **Schatten:** nur zwei — `shadow-lg` für schwebende
Elemente, `shadow-2xl` für die Hero-Karte. Sonst `ring-1 ring-[#EAECEF]`.

---

## 4. Hörproben — das neue Herzstück

Der überzeugendste Beweis für einen Klavierlehrer ist, ihn spielen zu hören.
Drei Sekunden Klang sagen mehr als vier Bewertungen.

### Aufbau

Eine Zeile pro Aufnahme, gestapelt. Kein Karussell — man soll alle auf einmal
sehen.

```
┌────────────────────────────────────────────────────┐
│  ▶   Nocturne op. 9 Nr. 2          ▁▃▅▇▅▃▁▃▅  2:14 │
│      Chopin · Fortgeschritten                       │
└────────────────────────────────────────────────────┘
```

| Element | Spezifikation |
|---|---|
| Abspielknopf | 48×48px, Kreis, `navy-900`, weisses Symbol. Beim Abspielen wird ▶ zu ❚❚ |
| Titel | `text-base font-600 text-navy-900` |
| Untertitel | `text-sm text-gray-400` — Komponist · Niveau |
| Wellenform | 48px hoch, 40–64 Balken je nach Breite, 3px breit, 1.5px Abstand, `rounded-full` |
| Dauer | `text-sm tabular-nums text-gray-400` |
| Zeile | `py-4`, Trennlinie `border-b border-[#EAECEF]`, letzte ohne |

### Wellenform

**Ruhezustand:** Balken in `navy-100`, Höhen aus der Datei vorberechnet und
als Zahlenfeld hinterlegt (nicht zur Laufzeit analysiert — das kostet einen
zweiten Download und flackert beim Laden).

**Beim Abspielen:** Balken links vom Abspielkopf in `navy-900`, rechts davon
`navy-100`. Der Abspielkopf wandert.

### Klaviatur

Unter der Wellenform erscheint während der Wiedergabe eine Klaviatur, deren
Tasten sich zum Klang bewegen. Balken sind das, was jeder Musikspieler zeigt —
hier geht es um Klavierunterricht, und dieselbe Bewegung auf Tasten übertragen
sagt sofort, worum es geht. Sie greift zudem das Tastatur-Motiv aus dem Hero
auf.

- 14 weisse Tasten, schwarze an ihren richtigen Stellen (nach C, D, F, G, A).
- Angetrieben von einem `AnalyserNode` am laufenden `<audio>`-Element, also
  vom tatsächlichen Klang — nicht von einer vorberechneten Kurve.
- Tasten liegen **logarithmisch** über 90–2600 Hz. Linear verteilt läge die
  halbe Klaviatur im Bass und bewegte sich kaum.
- Hohe Töne werden angehoben (Faktor 1 bis 2.6), sonst bewegte sich nur die
  linke Hälfte.
- Anschlagtiefe höchstens 3 px. Eine Taste, die einen Zentimeter einsinkt,
  sieht nach Fehler aus statt nach Anschlag.
- Nur sichtbar, während gespielt wird. Dauerhaft wären es vier stumme
  Tastaturen untereinander.
- Gezeichnet ausserhalb von React: 60 Neuaufbauten je Sekunde für eine
  Verzierung wären verschwendet.

**Klickbar:** Ein Klick in die Wellenform springt an diese Stelle. Trefffläche
mindestens 48px hoch, auch wenn die Balken kürzer sind.

### Verhalten

| Zustand | Verhalten |
|---|---|
| Nichts läuft | Alle Wellenformen ruhig, alle Knöpfe zeigen ▶ |
| Abspielen starten | Eine laufende Aufnahme wird gestoppt — **nie zwei gleichzeitig** |
| Lädt | Knopf zeigt einen dezenten Kreis-Spinner, Wellenform bleibt ruhig |
| Zu Ende | Springt auf 0 zurück, Knopf wieder ▶. Kein Auto-Weiter |
| Datei fehlt | Zeile ausgrauen, „Aufnahme nicht verfügbar", Knopf inaktiv |
| Kein Ton möglich | Wenn `play()` abgewiesen wird (Browser-Sperre), Hinweis „Zum Abspielen antippen" |

### Technik

- `<audio preload="metadata">` — Metadaten für die Dauer, Audio erst auf Klick.
  Fünf vorgeladene Aufnahmen wären mehrere Megabyte für nichts.
- Format **MP3, 128 kbps mono** für Sprachbeispiele, **192 kbps stereo** für
  Musik. Ziel: unter 3 MB pro Aufnahme.
- Wellenformdaten als `number[]` (0–1) neben der Datei, z. B. `nocturne.json`.
  Einmalig mit `audiowaveform` oder `ffmpeg` erzeugen.
- Kein Web-Audio-API-Analyser. Er bräuchte die entschlüsselte Datei im
  Speicher, verzögert den Start und bricht bei manchen mobilen Browsern.

### Was aufnehmen

Drei bis fünf Stücke, jeweils **30–60 Sekunden**, nicht ganze Werke. Ein
Besucher hört nicht zwei Minuten zu, bevor er weiterscrollt.

Sinnvolle Mischung: ein klassisches Stück (zeigt Handwerk), ein
Pop-Arrangement (zeigt, dass du nicht nur Klassik machst), etwas Eigenes oder
Improvisiertes (zeigt Persönlichkeit). Wenn möglich zusätzlich eine
**Schüleraufnahme** mit Erlaubnis — nichts überzeugt Eltern mehr als ein Kind,
das nach einem Jahr etwas Erkennbares spielt.

Aufnahme mit dem Handy reicht, wenn der Raum still ist und das Handy auf dem
Klavier liegt statt in der Hand.

---

## 5. Bilder und Illustrationen

Vorhanden ist ein Porträt (`david-ramchandani-portrait-720-762.jpg`), im
Abschnitt „Über mich" eingesetzt. Für den Rest hier, was an welcher Stelle
wirkt — und was als Platzhalter taugt, bis du fotografierst.

| Ort | Was hingehört | Format | Bis dahin |
|---|---|---|---|
| Hero, rechts | **Du am Klavier**, Halbtotale, Blick zur Tastatur statt in die Kamera. Tageslicht von der Seite. Nicht lächelnd-posiert — arbeitend | 4:5 hoch, ab 1200px | Das bestehende Porträt, freigestellt vor `surface` |
| Hörproben | Kein Bild. Die Wellenform ist das Bild | — | — |
| Vorteile | Drei kleine Strichzeichnungen, `navy-900`, 1.5px Linie, kein Flächenfüllung — passend zur SVG-Klaviatur im Hero | 64×64 | Lucide-Icons, gleiche Strichstärke |
| Über mich | Vorhandenes Porträt | 4:5 | steht |
| Bewertungen | Keine Fotos. Erfundene Avatare sind der schnellste Weg, unglaubwürdig zu wirken | — | Initialen auf `navy-50` |
| Pakete | Kein Bild | — | — |
| CTA | Kein Bild, `navy-900`-Fläche | — | — |

**Stockfotos: nein.** Ein Stockbild von fremden Händen auf einer fremden
Klaviatur ist bei einem Einzelunternehmer sofort erkennbar und kostet genau
das Vertrauen, das die Seite aufbauen soll. Lieber gar kein Bild als ein
falsches — die Seite trägt das, weil Typografie und Weissraum die Arbeit
machen.

**Falls du fotografierst:** ein Termin, eine Stunde, Tageslicht. Vier Motive
genügen — du am Klavier (Halbtotale), Hände auf den Tasten (nah), du im
Gespräch mit einem Schüler, ein leerer Klavierhocker von schräg oben. Das
letzte ist erstaunlich brauchbar als ruhiges Hintergrundbild.

---

## 6. Zustände und Interaktionen

| Element | Zustand | Verhalten |
|---|---|---|
| Primärknopf | Ruhe | `bg-navy-900`, `shadow-lg shadow-navy-900/20` |
| | Hover | `translateY(-1px)`, Schatten wächst auf `/30`, 150ms |
| | Aktiv | `translateY(0)`, Schatten zurück, 80ms |
| | Fokus | `outline: 2px solid #1C244B; outline-offset: 2px` |
| Sekundärknopf | Hover | Rahmen `gray-200` → `navy-900`, Hintergrund bleibt |
| Paketkarte | Hover | `translateY(-2px)`, `ring` wird `navy-200`, 200ms |
| | Empfohlen | `ring-2 ring-navy-900` + Band „Am beliebtesten" |
| Hörprobe | Hover | Zeilenhintergrund `navy-50/40` |
| | Läuft | Abspielknopf bleibt `navy-900`, Wellenform zweifarbig |
| Termin-Karte | Kein Termin frei | „Auf Anfrage" statt Datum, CTA bleibt aktiv |
| Navigation | Gescrollt > 40px | Hintergrund `white/80` + `backdrop-blur`, Hairline unten |

---

## 7. Verhalten nach Breite

| Breite | Änderungen |
|---|---|
| Ab 1024px | Hero zweispaltig, Pakete dreispaltig, Über mich zweispaltig |
| 768–1024px | Hero einspaltig, Bild unter dem Text. Pakete zweispaltig, empfohlenes zuerst |
| Unter 768px | Alles einspaltig. Hero-Bild **über** dem Text, aber max. 40vh hoch, damit die Headline ohne Scrollen sichtbar bleibt. CTAs volle Breite, gestapelt. Wellenform auf 32 Balken reduziert |

**Mobil zuerst prüfen.** Der Grossteil der Besucher kommt vom Handy, oft über
eine Suche nach „Klavierunterricht Winterthur". Die erste Bildschirmhöhe muss
Headline, ein Satz und den Probelektions-Knopf zeigen — sonst nichts.

---

## 8. Randfälle

- **Kein freier Termin:** „Auf Anfrage" statt Datum. Der Knopf bleibt aktiv und
  führt zum Formular — jemanden wegen fehlender Termine abzuweisen, verliert
  ihn endgültig.
- **Keine Bewertungen:** Abschnitt ganz weglassen statt „Noch keine
  Bewertungen" zu zeigen. Leere Zustände auf einer Verkaufsseite sind schädlich.
- **Keine Hörproben hinterlegt:** Abschnitt weglassen. Die Seite funktioniert
  ohne, nur schwächer.
- **Lange Namen in Bewertungen:** eine Zeile, dann `truncate`.
- **Langsame Verbindung:** Hero-Bild mit `priority`, alles darunter `lazy`.
  Kein Ladeskelett für den Hero — der Text ist serverseitig da und erscheint
  sofort, das Bild kommt nach.
- **JavaScript aus:** Alle Inhalte und Links funktionieren. Nur die
  Hörproben-Wellenform fällt auf ein einfaches `<audio controls>` zurück.

---

## 9. Bewegung

Zurückhaltend. Auf „Mut 3" heisst: spürbar, aber nie im Weg.

| Element | Auslöser | Bewegung | Dauer | Kurve |
|---|---|---|---|---|
| Hero-Text | Laden | Einblenden + 12px von unten | 500ms | `--ease-out-soft` |
| Hero-CTA | Laden | dito, 200ms später | 500ms | `--ease-out-soft` |
| Hero-Pills | Laden | dito, 300ms später | 500ms | `--ease-out-soft` |
| Abschnitte | 15% sichtbar | Einblenden + 16px von unten | 600ms | `--ease-out-soft` |
| Karten in einer Reihe | 15% sichtbar | dito, je 80ms versetzt | 600ms | `--ease-out-soft` |
| Zahlen (16+, 5.0) | sichtbar | von 0 hochzählen | 900ms | `ease-out` |
| Wellenform-Fortschritt | Abspielen | Farbwechsel folgt der Zeit | fortlaufend | linear |
| Klaviatur | Abspielen | Tasten sinken bis 3 px, Füllung nach Lautstärke | fortlaufend | linear |
| Klaviatur | Start / Ende | Höhe 0 → 56 px | 300ms | `--ease-out-soft` |
| Knopf-Hover | Hover | `translateY(-1px)` | 150ms | `--ease-out-soft` |

**Einblenden nur einmal.** Wer zurückscrollt, soll nicht dieselbe Animation
noch einmal sehen — das wirkt billig. `IntersectionObserver` mit
`unobserve` nach dem ersten Auslösen.

**`prefers-reduced-motion` ist bereits global umgesetzt** (globals.css
Zeile 258). Neue Animationen müssen sich daran halten: Einblendungen werden zu
sofortiger Sichtbarkeit, das Pulsieren der Wellenform entfällt ganz, der
Fortschrittsbalken bleibt — er ist Information, keine Zierde.

---

## 10. Zugänglichkeit

- **Fokusreihenfolge** folgt der Lesereihenfolge. Im Hero: Kicker (kein Fokus)
  → Headline (kein Fokus) → Probelektion-Knopf → Angebote-Knopf → Termin-Karte.
- **Abspielknopf:** `aria-label="Nocturne op. 9 Nr. 2 abspielen"`, beim Laufen
  „… pausieren". Nicht nur „Play".
- **Wellenform:** `role="slider"`, `aria-valuemin="0"`, `aria-valuemax` =
  Dauer in Sekunden, `aria-valuenow` = Position, `aria-label="Position in der
  Aufnahme"`. Mit Pfeiltasten in 5-Sekunden-Schritten bedienbar.
- **Laufender Titel** wird über `aria-live="polite"` angesagt, wenn sich die
  Wiedergabe ändert — sonst merkt ein Screenreader-Nutzer nicht, dass das
  Antippen etwas bewirkt hat.
- **Kontrast:** `gray-400` auf weiss erreicht 4.5:1 nur ab 16px. Für
  Bildunterschriften unter 16px `gray-500` verwenden.
- **Sterne** sind dekorativ (`aria-hidden`), die Bewertung steht als Text
  daneben: „5.0 aus 4 Bewertungen".
- **Alle Animationen** sind rein visuell — keine Information geht verloren,
  wenn sie nicht laufen.

---

## 11. Reihenfolge der Umsetzung

1. **Hörproben-Abschnitt** — das einzige wirklich neue Stück, und das mit dem
   grössten Effekt. Funktioniert auch allein, ohne den Rest.
2. **Hero aufräumen** — Preis raus, Porträt rein, ein CTA statt zwei
   gleichwertiger.
3. **Reihenfolge umstellen** — reine Umsortierung in `page.tsx`, ein Commit.
4. **Einblendungen beim Scrollen** — ein wiederverwendbarer Baustein für alle
   Abschnitte.
5. **Feinschliff** — Zahlen hochzählen, Navigations-Unschärfe, mobile Höhen.

Schritt 1 und 3 zusammen bringen den grössten Teil der Wirkung. Wenn die Zeit
knapp ist, hör nach Schritt 3 auf.
