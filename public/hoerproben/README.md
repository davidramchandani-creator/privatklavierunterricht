# Hörproben

Hier kommen die Aufnahmen hin. Danach in `src/lib/hoerproben.ts` eintragen —
solange die Liste dort leer ist, erscheint der Abschnitt auf der Startseite
gar nicht.

## Format

- **MP3, 192 kbps stereo.** Ziel: unter 3 MB pro Aufnahme.
- **30–60 Sekunden**, nicht das ganze Werk. Niemand hört zwei Minuten zu,
  bevor er weiterscrollt.
- Dateiname klein, ohne Umlaute: `nocturne-op9-nr2.mp3`.

## Wellenform erzeugen

Die Balken sind vorberechnet, nicht im Browser analysiert — sonst müsste die
ganze Datei geladen sein, bevor überhaupt etwas zu sehen ist.

```bash
node scripts/wellenform.mjs public/hoerproben/nocturne-op9-nr2.mp3
```

Das Skript gibt ein Zahlenfeld aus, das direkt in `hoerproben.ts` gehört.

## Aufnehmen

Handy reicht, wenn der Raum still ist und das Gerät auf dem Klavier liegt
statt in der Hand. Wichtiger als die Technik ist, dass es nicht nach Konzert
klingt, sondern nach jemandem, der spielt.
