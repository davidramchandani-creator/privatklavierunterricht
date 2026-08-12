#!/usr/bin/env node
// ============================================================
// Wellenform aus einer Audiodatei berechnen.
//
// Ergebnis ist ein Zahlenfeld zwischen 0 und 1, das in
// src/lib/hoerproben.ts eingetragen wird.
//
// Warum vorberechnet und nicht im Browser: Eine Analyse zur Laufzeit
// bräuchte die vollständige Datei im Speicher, verzögert den Start um
// Sekunden und bricht auf manchen mobilen Browsern ganz. So steht die
// Wellenform sofort, auch bevor jemand auf Abspielen drückt.
//
// Braucht ffmpeg:  brew install ffmpeg
// Aufruf:          node scripts/wellenform.mjs public/hoerproben/stueck.mp3
// ============================================================

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename } from "node:path";

const datei = process.argv[2];
const BALKEN = 96; // fein genug für breite Bildschirme, wird im Client gekürzt

if (!datei) {
  console.error("Aufruf: node scripts/wellenform.mjs <datei.mp3>");
  process.exit(1);
}
if (!existsSync(datei)) {
  console.error(`Datei nicht gefunden: ${datei}`);
  process.exit(1);
}

// Mono, 8 kHz, 16-bit roh — mehr braucht eine Wellenform nicht, und es hält
// die Zwischendatei klein.
const ff = spawnSync(
  "ffmpeg",
  ["-v", "quiet", "-i", datei, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
  { maxBuffer: 1024 * 1024 * 256, encoding: "buffer" }
);

if (ff.error) {
  console.error("ffmpeg nicht gefunden. Installieren mit: brew install ffmpeg");
  process.exit(1);
}
if (ff.status !== 0) {
  console.error("ffmpeg konnte die Datei nicht lesen.");
  process.exit(1);
}

const roh = ff.stdout;
const proben = roh.length / 2;
const proBalken = Math.floor(proben / BALKEN);

const werte = [];
for (let b = 0; b < BALKEN; b++) {
  let summe = 0;
  for (let i = 0; i < proBalken; i++) {
    const wert = roh.readInt16LE((b * proBalken + i) * 2);
    summe += wert * wert;
  }
  // Effektivwert statt Spitzenwert: ein einzelner Knacks soll den Balken
  // nicht auf volle Höhe reissen.
  werte.push(Math.sqrt(summe / proBalken) / 32768);
}

// Auf den lautesten Balken normieren, sonst sähe ein leise aufgenommenes
// Stück wie eine flache Linie aus.
const groesster = Math.max(...werte, 0.0001);
const normiert = werte.map((w) => Number((w / groesster).toFixed(3)));

const dauerSek = Math.round(proben / 8000);

console.log(`// ${basename(datei)} — ${Math.floor(dauerSek / 60)}:${String(dauerSek % 60).padStart(2, "0")}`);
console.log(`dauer: ${dauerSek},`);
console.log(`wellenform: [${normiert.join(", ")}],`);
