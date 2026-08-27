# Design-System

Kurz: **Eine Schrift, ein dunkles Blau, sehr wenige Abstufungen.** Der Rest
ergibt sich daraus. Dieses Dokument beschreibt, was hier tatsächlich verwendet
wird — nicht was einmal geplant war. Die Zahlen darin sind aus dem Code
ausgezählt, nicht geschätzt.

Zum Mitnehmen in ein anderes Projekt reicht der Block ganz unten
(«Startpaket»).

---

## Grundhaltung

Schlicht, modern, ruhig. Nicht überladen. Bewegung ist dezent und kurz und
erklärt immer etwas — sie schmückt nicht.

Drei Regeln, die den Ton machen:

1. **Weniger Abstufungen als man denkt.** Zwei Schriftgrössen tragen 80 % aller
   Texte. Drei Eckenradien reichen. Wer eine vierte einführt, macht das Bild
   unruhiger, nicht reicher.
2. **Farbe bedeutet etwas.** Grün, Gelb und Rot sind Status, keine Dekoration.
   Wenn irgendwo Grün steht, heisst das «bezahlt» oder «aktiv» — nie «hübsch».
3. **Weiss auf hellgrau.** Karten sind weiss, der Untergrund ist `#F3F5F8`.
   Tiefe entsteht durch diesen Unterschied plus einen sehr weichen Schatten,
   nicht durch Rahmen und Linien.

---

## Schrift

**Plus Jakarta Sans**, durchgängig, nichts anderes. Über `next/font/google`
geladen und selbst gehostet — kein `@import` von `fonts.googleapis.com`, das
lädt die Schrift ein zweites Mal und blockiert dabei das Rendern.

```ts
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],  // 200/300 bewusst weggelassen
  variable: "--font-jakarta",
  display: "swap",
});
```

Jedes Gewicht ist eine eigene Datei. Nur laden, was benutzt wird.

### Gewichte

| Klasse | Wofür | Wie oft im Code |
|---|---|---|
| `font-800` | Seitentitel (`h1`), grosse Zahlen | 86× |
| `font-700` | Abschnittsüberschriften, Kartentitel | 172× |
| `font-600` | **Der Arbeitsesel.** Beschriftungen, Knöpfe, Tabellenköpfe | 472× |
| `font-500` | Leicht hervorgehoben in Fliesstext | 146× |
| `font-400` | Normaler Fliesstext (Standard, selten nötig) | 16× |

Die Schreibweise `font-600` statt `font-semibold` funktioniert erst ab Tailwind
v4 (nackte Zahlenwerte). In älteren Projekten muss das `font-semibold`,
`font-bold` usw. heissen.

### Grössen

| Klasse | Grösse | Wofür |
|---|---|---|
| `text-xs` | 12px | Nebeninformation, Abzeichen, Tabellenköpfe |
| `text-sm` | 14px | **Standard.** Fast alles im Admin und im Portal |
| `text-base` | 16px | Fliesstext auf öffentlichen Seiten |
| `text-lg` | 18px | Kartenüberschriften |
| `text-2xl` | 24px | Seitentitel |
| `text-3xl` / `text-4xl` | 30/36px | Nur auf der Startseite |

`text-sm` und `text-xs` machen zusammen rund 1160 von etwa 1400 Fundstellen.
Das ist der Kern: **Die Oberfläche ist bewusst klein gesetzt**, damit viel
gleichzeitig sichtbar ist, ohne gedrängt zu wirken.

Ausnahmen für sehr enge Stellen: `text-[11px]`, `text-[10px]`, `text-[13px]`.
Sparsam einsetzen.

---

## Farben

### Marke

| Name | Wert | Wofür |
|---|---|---|
| `navy-900` / `navy` | `#1C244B` | Primärfarbe. Titel, Knöpfe, aktive Zustände |
| `navy-50` | `#f0f1f8` | Sehr helle Fläche für Info-Abzeichen |
| `surface` | `#F3F5F8` | Seitenhintergrund hinter weissen Karten |
| `gold` / `gold-500` | `#C9A84C` | Akzent, sehr sparsam |

Die volle Navy-Skala (50 bis 900) und die Gold-Skala liegen im `@theme`-Block
in `globals.css`. In der Praxis werden fast nur `navy-900`, `navy-50` und
`surface` gebraucht.

### Status

| Bedeutung | Farbe | Hintergrund/Text im Abzeichen |
|---|---|---|
| Erfolg, bezahlt, aktiv | `#10b981` | `bg-emerald-50 text-emerald-700` |
| Warnung, in Prüfung, pausiert | `#f59e0b` | `bg-amber-50 text-amber-700` |
| Offen, abgelehnt, abgelaufen | `#f87171` / `#dc2626` | `bg-red-50 text-red-700` |
| Neutral, storniert, archiviert | Slate | `bg-slate-100 text-slate-600` |
| Info, gebucht | Navy | `bg-navy-50 text-navy-900` |

**Wichtig, und der Teil, den man in anderen Projekten am ehesten falsch macht:**
Diese Zuordnung steht an **einer** Stelle, in `components/ui/status-badge.tsx`.
Dort wird aus einem technischen Status («pending_confirmation») ein deutsches
Wort («In Prüfung») und eine Farbe. Nirgends sonst wird ein Status eingefärbt.

Wenn diese Zuordnung über die Oberfläche verstreut ist, driftet sie
unweigerlich auseinander — dieselbe Sache heisst an zwei Orten anders und ist
verschieden eingefärbt. Das ist kein Schönheitsfehler, sondern eine
Fehlerquelle: Der Benutzer glaubt dann, es seien zwei verschiedene Dinge.

---

## Ecken

| Klasse | Radius | Wofür | Häufigkeit |
|---|---|---|---|
| `rounded-lg` | 8px | Kleine Knöpfe, Eingabefelder, Abzeichen | 220× |
| `rounded-xl` | 12px | Grössere Knöpfe, innere Felder | 259× |
| `rounded-2xl` | 16px | **Karten.** Alles, was ein eigener Block ist | 199× |
| `rounded-full` | rund | Abzeichen, Punkte, Avatare | 78× |

Faustregel: **je grösser die Fläche, desto grösser der Radius.** Ein
16px-Radius auf einem kleinen Knopf sieht aufgeblasen aus, ein 8px-Radius auf
einer grossen Karte hart.

---

## Abstände

Alles ist ein Vielfaches von 4px (Tailwinds Grundraster).

| Zweck | Klasse | Wert |
|---|---|---|
| Karteninnenraum, kompakt | `p-4` | 16px |
| Karteninnenraum, Standard | `p-5` | 20px |
| Karteninnenraum, grosszügig | `p-6` / `p-8` | 24 / 32px |
| Abstand zwischen Karten | `space-y-6` | 24px |
| Abstand innerhalb einer Karte | `space-y-3` / `space-y-4` | 12 / 16px |
| Symbol zu Text | `gap-2` | 8px |
| Knöpfe nebeneinander | `gap-2` / `gap-3` | 8 / 12px |
| Zeilen einer Liste | `space-y-1` / `space-y-1.5` | 4 / 6px |

Seitenränder: `px-4` am Handy, `px-6` ab Tablet.

---

## Schatten und Tiefe

Nur **ein** Schatten im Normalfall: `shadow-sm`. 84 von etwa 120 Fundstellen.
Grössere Schatten (`shadow-lg`, `shadow-xl`) sind schwebenden Dingen
vorbehalten — Dialoge, das Menüblatt.

Die Standardkarte sieht überall so aus:

```html
<div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
```

Anfassbare Karten bekommen zusätzlich einen Hover-Lift:

```css
.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -4px rgba(28, 36, 75, 0.10);
}
```

Der Schatten ist **nicht** schwarz, sondern eingefärbtes Navy
(`rgba(28,36,75,…)`). Schwarze Schatten wirken auf hellem Grund schmutzig.

---

## Bewegung

Zwei Kurven, mehr braucht es nicht:

```css
--ease-ios:      cubic-bezier(0.32, 0.72, 0, 1);  /* federnd, sanftes Ausrollen */
--ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);  /* schnell rein, weich raus */
```

| Animation | Dauer | Wofür |
|---|---|---|
| `animate-fade-in` | 500ms | Seiteninhalt beim Laden |
| `animate-slide-in` | 400ms | Menüs, Blätter |
| `animate-scale-in` | 300ms | Dialoge |
| `animate-enter-up` | 280ms | Reiter- und Schrittwechsel |
| `.press` | 120ms | Eindrücken beim Antippen (`scale(0.96)`) |

Nichts dauert länger als eine halbe Sekunde. Alles darüber fühlt sich zäh an.

**Pflicht, nicht optional:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Wer diese Einstellung im Betriebssystem setzt, tut das oft, weil ihm von
Bewegung schlecht wird. Das zu ignorieren ist nicht Geschmackssache.

---

## Liquid Glass

Die untere Navigationsleiste und die oberen Kopfleisten sind Glas im Stil von
iOS: durchsichtig, mit Lichtkante oben und starkem Weichzeichner dahinter.
Klassen: `.liquid-glass`, `.liquid-glass-bar`, `.liquid-lozenge` (die Linse
hinter dem aktiven Reiter). Vollständig in `globals.css`.

Das ist der einzige aufwendige Effekt im ganzen System — und er sitzt genau an
der Stelle, die man am häufigsten sieht. Sparsam bleiben: Glas über Glas wird
Matsch.

---

## Handy zuerst

Das gilt hier nicht als Anspruch, sondern ist geprüft: keine Seite läuft bei
390px Breite seitlich über.

**Die Regeln:**

- Ausgangspunkt ist die schmale Ansicht. Breakpoints (`sm:`, `md:`, `lg:`)
  bauen nach oben auf, nie umgekehrt.
- Tabellen lösen es auf genau zwei Arten: Spalten ausblenden
  (`hidden sm:table-cell`) **oder** seitlich scrollen mit
  `overflow-x-auto -mx-4 px-4`. Die negativen Ränder sorgen dafür, dass der
  Scrollbereich bis an den Kartenrand geht statt mittendrin abzuschneiden.
- Lange Texte in Zeilen: Elternelement `min-w-0 flex-1`, Text `truncate`. Ohne
  `min-w-0` schrumpft ein Flex-Kind nicht und schiebt alles hinaus.
- Eingabefelder auf iOS mindestens 16px, sonst zoomt Safari beim Antippen von
  selbst hinein:

  ```css
  @supports (-webkit-touch-callout: none) {
    input, textarea, select { font-size: 16px !important; }
  }
  ```

- Alles, was am unteren Rand klebt, braucht `env(safe-area-inset-bottom)`,
  sonst liegt es unter dem Balken des iPhones. Dazu im Viewport
  `viewportFit: "cover"`.
- Antippbare Flächen mindestens 44×44px.

**Eine Falle aus diesem Projekt:** Wenn es zwei getrennte Navigationslisten
gibt (Seitenleiste am Desktop, untere Leiste am Handy), laufen sie
auseinander. Hier fehlten fünf Seiten am Handy — erreichbar nur noch über die
Adresszeile, ohne dass irgendetwas kaputtging. Wenn du das in ein neues Projekt
übernimmst: **einen Test schreiben, der beide Listen vergleicht.**

---

## Startpaket für ein neues Projekt

Voraussetzung: Tailwind v4.

**1.** In `globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-navy-50:  #f0f1f8;
  --color-navy-900: #1c244b;
  --color-navy:     #1c244b;
  --color-gold:     #c9a84c;
  --color-surface:  #f3f5f8;

  --color-status-paid:    #10b981;
  --color-status-pending: #f59e0b;
  --color-status-open:    #f87171;
  --color-status-error:   #dc2626;
}

:root {
  --ease-ios:      cubic-bezier(0.32, 0.72, 0, 1);
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
}

body {
  font-family: var(--font-jakarta), "Plus Jakarta Sans", sans-serif;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 { font-weight: 700; }

*:focus-visible {
  outline: 2px solid #1C244B;
  outline-offset: 2px;
  border-radius: 6px;
}

@supports (-webkit-touch-callout: none) {
  input, textarea, select { font-size: 16px !important; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**2.** Die Schrift wie oben über `next/font/google` einbinden.

**3.** Die Standardkarte als Muster nehmen:
`bg-white rounded-2xl border border-gray-200 shadow-sm p-5`

**4.** Eine `StatusBadge`-Komponente anlegen, **bevor** der erste Status
irgendwo von Hand eingefärbt wird. Danach ist es mühsam.

---

## Zwei Dinge, die in diesem Repo aufgeräumt gehören

Falls du das hier als Vorlage nimmst, nicht mitkopieren:

**`tailwind.config.ts` ist wirkungslos.** Tailwind v4 liest die
Konfiguration aus dem `@theme`-Block in `globals.css`. Die alte
Konfigurationsdatei würde nur gelesen, wenn `@config "…"` in der CSS-Datei
stünde — das tut sie nicht. Wer dort eine Farbe ändert, wundert sich, warum
nichts passiert. Die Datei definiert unter anderem `gold-800` und `gold-900`,
die es in Wirklichkeit gar nicht gibt (benutzt werden sie zum Glück nirgends).

**Die shadcn-Variablen (`--primary`, `--secondary`, `--muted` …) sind
Restbestand.** Sie stammen aus der Startvorlage und werden fast nirgends
verwendet: `bg-secondary` einmal, `bg-accent` einmal, `bg-destructive`
dreimal. In einem neuen Projekt entweder konsequent nutzen oder gleich
weglassen — beides halb zu haben ist der schlechteste Zustand.
