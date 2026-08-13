#!/usr/bin/env node
// ============================================================
// Handyvideo für die Website aufbereiten.
//
// Ein Video direkt vom Handy wiegt schnell 20 MB für 30 Sekunden — mehr als
// die ganze übrige Startseite. Dieses Skript macht daraus etwa 1–2 MB, ohne
// dass man den Unterschied sieht, und schneidet ein Standbild heraus.
//
// Das Standbild ist nicht Beiwerk: Ohne `poster` zeigt der Browser einen
// schwarzen Kasten, bis jemand auf Abspielen drückt. Vier schwarze Kästen
// nebeneinander sehen nach kaputt aus.
//
// Braucht ffmpeg:  brew install ffmpeg
// Aufruf:          node scripts/video-aufbereiten.mjs public/schuelervideos/roh.mp4
// ============================================================

import { spawnSync } from "node:child_process";
import { existsSync, statSync, renameSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

const eingabe = process.argv[2];
if (!eingabe || !existsSync(eingabe)) {
  console.error("Aufruf: node scripts/video-aufbereiten.mjs <video.mp4>");
  process.exit(1);
}

const ordner = dirname(eingabe);
const name = basename(eingabe, extname(eingabe));
const ziel = join(ordner, `${name}.web.mp4`);
const poster = join(ordner, `${name}.jpg`);

function ff(args, was) {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.error) {
    console.error("ffmpeg nicht gefunden. Installieren mit: brew install ffmpeg");
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`${was} fehlgeschlagen:\n${r.stderr.split("\n").slice(-6).join("\n")}`);
    process.exit(1);
  }
}

const vorher = statSync(eingabe).size;

// 720p reicht: Das Video läuft in einer Karte, nicht im Vollbild.
// CRF 26 ist der Punkt, an dem man bei Handyaufnahmen nichts mehr sieht.
// faststart schiebt die Kopfdaten an den Anfang, damit die Wiedergabe
// beginnt, bevor die Datei ganz geladen ist.
ff([
  "-v", "error", "-i", eingabe,
  "-vf", "scale='min(1280,iw)':-2",
  "-c:v", "libx264", "-crf", "26", "-preset", "slow",
  "-c:a", "aac", "-b:a", "96k",
  "-movflags", "+faststart",
  "-y", ziel,
], "Umwandeln");

// Standbild aus Sekunde 1 – Bild 0 ist bei Handyaufnahmen oft unscharf,
// weil die Kamera noch scharfstellt.
ff([
  "-v", "error", "-ss", "1", "-i", ziel,
  "-frames:v", "1", "-q:v", "3",
  "-y", poster,
], "Standbild");

const nachher = statSync(ziel).size;

// Die aufbereitete Datei tritt an die Stelle der Rohdatei; das Original
// bleibt daneben liegen, falls die Qualität doch nicht reicht.
const original = join(ordner, `${name}.original${extname(eingabe)}`);
renameSync(eingabe, original);
renameSync(ziel, join(ordner, `${name}.mp4`));

const mb = (b) => (b / 1024 / 1024).toFixed(1);
console.log(`${basename(eingabe)}: ${mb(vorher)} MB → ${mb(nachher)} MB`);
console.log(`Standbild: ${basename(poster)}`);
console.log(`Original liegt als ${basename(original)} daneben.`);
console.log();
console.log("Eintrag für src/lib/schuelervideos.ts:");
console.log(`  {
    id: "${name}",
    titel: "…",
    wer: "…, seit … ",
    datei: "/schuelervideos/${name}.mp4",
    poster: "/schuelervideos/${name}.jpg",
    dauer: 0,
  },`);
