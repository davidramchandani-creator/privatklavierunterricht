#!/usr/bin/env node
// ============================================================
// Handyvideo für die Website aufbereiten.
//
// Ein Video direkt vom Handy wiegt schnell 30 MB für 20 Sekunden, mehr als
// die ganze übrige Startseite. Dieses Skript macht daraus etwa 1 bis 3 MB, ohne
// dass man den Unterschied sieht, und schneidet ein Standbild heraus.
//
// Vier Dinge passieren dabei, die einzeln unscheinbar wirken:
//
// **H.264 statt HEVC.** iPhones nehmen in HEVC auf. Safari spielt das ab,
// Firefox nicht. Wer das übersieht, hat auf einem Drittel der Rechner einen
// schwarzen Kasten und erfährt nie davon.
//
// **Lautheit angleichen.** Vier Aufnahmen aus vier Wohnzimmern liegen leicht
// 12 dB auseinander. Ohne Angleich ist ein Video kaum hörbar und das nächste
// so laut, dass man erschrickt, und niemand schaut ein drittes an.
//
// **Standbild.** Ohne `poster` zeigt der Browser einen schwarzen Kasten, bis
// jemand auf Abspielen drückt. Vier schwarze Kästen sehen nach kaputt aus.
//
// **Höchstens 30 Bilder/Sekunde.** 60 fps verdoppelt die Dateigrösse und
// bringt bei Händen auf Tasten nichts.
//
// Braucht ffmpeg:  brew install ffmpeg
//
// Aufruf:
//   node scripts/video-aufbereiten.mjs public/schuelervideos/IMG_1055.mov
//
// Zusätzlich möglich:
//   --oben 8      obere 8 % wegschneiden (Bildausschnitt bleibt 16:9).
//                 Nützlich, wenn am oberen Rand ein Kopf ins Bild ragt.
//   --links 26    linke 26 % wegschneiden. Nützlich, wenn seitlich etwas
//                 steht, das nicht ins Bild gehört: ein Notenheft mit
//                 fremdem Umschlag, eine Wasserflasche, ein Stück Zimmer.
//   --von 5       erst ab Sekunde 5
//   --bis 35      nur bis Sekunde 35
//   --stumm       Tonspur ganz entfernen
// ============================================================

import { spawnSync } from "node:child_process";
import { existsSync, statSync, renameSync, unlinkSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

// ── Aufruf lesen ────────────────────────────────────────────
const argv = process.argv.slice(2);
const eingabe = argv.find((a) => !a.startsWith("--") && !/^\d/.test(a));

function opt(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const obenProzent = Number(opt("oben") ?? 0);
const linksProzent = Number(opt("links") ?? 0);
const von = opt("von");
const bis = opt("bis");
const stumm = argv.includes("--stumm");

if (!eingabe || !existsSync(eingabe)) {
  console.error("Aufruf: node scripts/video-aufbereiten.mjs <video.mov> [--oben 8] [--von 5] [--bis 35] [--stumm]");
  process.exit(1);
}

const ordner = dirname(eingabe);
const name = basename(eingabe, extname(eingabe));
const zwischen = join(ordner, `${name}.web.mp4`);
const poster = join(ordner, `${name}.jpg`);

function ff(args, was) {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.error) {
    console.error("ffmpeg nicht gefunden. Installieren mit: brew install ffmpeg");
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`${was} fehlgeschlagen:\n${r.stderr.split("\n").slice(-8).join("\n")}`);
    process.exit(1);
  }
  return r.stderr;
}

function probe(feld, datei, extra = []) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", ...extra, "-show_entries", feld, "-of", "csv=p=0", datei],
    { encoding: "utf8" },
  );
  return r.stdout.trim();
}

const vorher = statSync(eingabe).size;

// ── Bildfilter zusammensetzen ───────────────────────────────
//
// Zwei Schritte, weil sie zwei verschiedene Fragen beantworten.
//
// Zuerst wird weggeschnitten, was nicht ins Bild gehört. Danach wird das
// Ergebnis auf 16:9 zurückgeführt, egal wie krumm es geworden ist. Die
// Seite zeigt das Video in einem 16:9-Rahmen mit `object-cover`; liefert
// man ein anderes Verhältnis, schneidet der Browser selbst nach, und zwar
// dort, wo es ihm passt. Lieber hier entscheiden, wo geschnitten wird.
const filter = [];
if (obenProzent > 0 || linksProzent > 0) {
  const oben = obenProzent / 100;
  const links = linksProzent / 100;
  filter.push(
    `crop=w='iw*(1-${links})':h='ih*(1-${oben})':x='iw*${links}':y='ih*${oben}'`,
  );
}
filter.push(
  `crop=w='min(iw\\,ih*16/9)':h='min(ih\\,iw*9/16)':x='(iw-ow)/2':y='(ih-oh)/2'`,
);
filter.push("scale='min(1280,iw)':-2");

// Der fps-Filter versteht keine Ausdrücke wie `min(30,source_fps)`, deshalb
// die Bildrate vorher auslesen und den Filter nur setzen, wenn er gebraucht
// wird. Ihn immer zu setzen wäre schlechter: Er würde 24-fps-Material auf 30
// hochrechnen und dabei Bilder verdoppeln.
const rohRate = probe("stream=r_frame_rate", eingabe, ["-select_streams", "v:0"]);
const [zaehler, nenner] = rohRate.split("/");
const quellRate = Number(zaehler) / Number(nenner || 1);
if (quellRate > 30) filter.push("fps=30");

// ── Tonfilter ───────────────────────────────────────────────
//
// -16 LUFS ist der Wert, auf den Streamingdienste normalisieren; -1.5 dBTP
// lässt genug Spielraum, dass die Umwandlung nicht übersteuert.
const tonfilter = "loudnorm=I=-16:TP=-1.5:LRA=11";

const args = ["-v", "error"];
if (von) args.push("-ss", von);
args.push("-i", eingabe);
if (bis) args.push("-to", String(Number(bis) - Number(von ?? 0)));
args.push(
  "-vf", filter.join(","),
  "-c:v", "libx264", "-crf", "26", "-preset", "slow",
  "-pix_fmt", "yuv420p", // ohne das zeigen ältere Player nur Grün
);
if (stumm) {
  args.push("-an");
} else {
  args.push("-af", tonfilter, "-c:a", "aac", "-b:a", "96k");
}
args.push("-movflags", "+faststart", "-y", zwischen);

ff(args, "Umwandeln");

// ── Standbild ───────────────────────────────────────────────
//
// Aus Sekunde 1, nicht 0: Beim ersten Bild stellt die Kamera oft noch scharf.
// Ist das Video kürzer als 2 Sekunden, nehmen wir die Mitte.
const dauer = Number(probe("format=duration", zwischen));
const posterZeit = dauer > 2 ? 1 : dauer / 2;
ff(
  ["-v", "error", "-ss", String(posterZeit), "-i", zwischen,
   "-frames:v", "1", "-q:v", "3", "-y", poster],
  "Standbild",
);

// ── Aufräumen ───────────────────────────────────────────────
//
// Die aufbereitete Datei tritt an die Stelle der Rohdatei; das Original
// bleibt daneben liegen, falls die Qualität doch nicht reicht.
const ziel = join(ordner, `${name}.mp4`);
const original = join(ordner, `${name}.original${extname(eingabe)}`);
if (existsSync(ziel) && ziel !== eingabe) unlinkSync(ziel);
renameSync(eingabe, original);
renameSync(zwischen, ziel);

const nachher = statSync(ziel).size;
const mb = (b) => (b / 1024 / 1024).toFixed(1);

console.log(`${basename(eingabe)}: ${mb(vorher)} MB → ${mb(nachher)} MB, ${dauer.toFixed(1)}s`);
console.log(`Standbild: ${basename(poster)}`);
console.log(`Original: ${basename(original)}`);
console.log();
console.log("Eintrag für src/lib/schuelervideos.ts:");
console.log(`  {
    id: "${name}",
    titel: "…",
    wer: "…, seit …",
    datei: "/schuelervideos/${name}.mp4",
    poster: "/schuelervideos/${name}.jpg",
    dauer: ${Math.round(dauer)},
  },`);
