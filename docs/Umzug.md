# Umzug: WordPress → neue Seite

Stand: 13. August 2026. Alle DNS-Werte hier sind ausgelesen, nicht geraten.

---

## Der wichtigste Satz vorweg

**Rühr die Einträge für E-Mail nicht an.** An der Domain hängt nicht nur die
Website. Wer beim Umstellen den falschen Eintrag löscht, merkt es nicht sofort:
Die Seite ist online, alles sieht gut aus, und still kommt seit Stunden keine
Mail mehr an. Umgestellt wird genau **ein** Eintrag, und zwar `A`.

---

## Was heute eingetragen ist

Nameserver liegen bei **Infomaniak** (`ns11.infomaniak.ch`, `ns12.infomaniak.ch`).
Dort wird auch der Umzug gemacht.

| Eintrag | Wert | Was daran hängt | Beim Umzug |
|---|---|---|---|
| `A` (Domain) | `185.125.27.109` | die alte WordPress-Seite | **ändern** |
| `A` (`www`) | `185.125.27.109` | dieselbe Seite | **ändern** |
| `MX` | `inbound-smtp.eu-west-1.amazonaws.com` | eingehende E-Mail | **nicht anfassen** |
| `TXT` | `v=spf1 -all` | Absenderprüfung | **nicht anfassen** |
| `TXT resend._domainkey` | `p=MIGfMA0…` | DKIM-Signatur von Resend | **nicht anfassen** |
| `TXT _dmarc` | `v=DMARC1; p=reject;` | Umgang mit gefälschter Post | **nicht anfassen** |

### Warum eure Mails überhaupt ankommen

Das ist beim Umzug gut zu wissen, weil es fragiler ist, als es aussieht.

`v=spf1 -all` heisst wörtlich: *kein* Server darf für diese Domain senden.
Trotzdem kommen die Mails durch, weil DMARC zwei Wege kennt und einer reicht:
Resend signiert jede Mail mit dem DKIM-Schlüssel, der oben im DNS steht, und
diese Signatur passt zur Absenderadresse. Damit ist DMARC zufrieden, obwohl SPF
scheitert.

Löscht jemand den DKIM-Eintrag, bleibt nur noch SPF, und SPF sagt Nein. Bei
`p=reject` bedeutet das nicht Spam-Ordner, sondern Zustellung verweigert. Ohne
Fehlermeldung bei dir.

> Wenn du ohnehin dran bist: `v=spf1 -all` durch einen Eintrag zu ersetzen, der
> Resend erlaubt, wäre eine echte Verbesserung. Aber **nicht am Umzugstag**.
> Eine Baustelle nach der anderen.

---

## Der Ablauf

### Eine Woche vorher

**TTL prüfen.** Die `A`-Einträge stehen bereits auf 300 Sekunden. Das ist ideal:
Die Umstellung greift nach fünf Minuten, nicht nach Stunden. Nichts zu tun.

**Umgebungsvariablen auf Vercel kontrollieren.** Diese müssen für *Production*
gesetzt sein:

| Variable | Wert |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://privatklavierunterricht.ch` |
| `EMAIL_FROM` | `david@privatklavierunterricht.ch` |
| `EMAIL_REDIRECT_TO` | **leer oder gelöscht** |

Der letzte Punkt ist der gefährlichste. Solange `EMAIL_REDIRECT_TO` gesetzt ist,
bekommt **kein Schüler Post** — alles landet bei dir. Das ist beim Testen
richtig und im Betrieb eine Katastrophe, die tagelang unbemerkt bleibt.

Steht `NEXT_PUBLIC_APP_URL` falsch, zeigen alle Links in den Mails ins Leere.

### Am Umzugstag

1. **Domain in Vercel hinzufügen.** Projekt → Settings → Domains →
   `privatklavierunterricht.ch` und `www.privatklavierunterricht.ch`.

2. **Werte aus dem Vercel-Dashboard abschreiben.** Vercel zeigt dort die
   IP-Adresse für den `A`-Eintrag an. Nimm den Wert, den *dein* Dashboard
   anzeigt. Die Werte, die in älteren Anleitungen im Netz stehen, sind
   inzwischen teilweise projektspezifisch.

3. **Bei Infomaniak eintragen.** Nur diese zwei Zeilen ändern:
   - `A` für die Domain: neue IP von Vercel
   - `A` (oder `CNAME`, falls Vercel das so vorgibt) für `www`

   Alle anderen Zeilen bleiben, wie sie sind.

4. **Fünf Minuten warten**, dann prüfen: `https://privatklavierunterricht.ch`
   zeigt die neue Seite, das Schloss im Browser ist zu (Vercel stellt das
   Zertifikat automatisch aus, das dauert ein paar Minuten länger als die
   Umstellung selbst).

5. **Alte Adressen stichprobenweise aufrufen.** Sie sind in `next.config.ts`
   umgeleitet:

   | alt | neu |
   |---|---|
   | `/allgemeine-geschaeftsbedingungen` | `/agb` |
   | `/kontaktiere-mich` | `/kontakt` |
   | `/login` · `/register` | `/auth/login` |
   | `/jetzt-buchen` · `/einzellektion-buchen` | `/probelektion` |
   | `/admin-2-0` | `/admin` |
   | `/empfehlen` | `/probelektion` |
   | `/partner` | `/` |
   | `/preise` · `/ueber-mich` | unverändert |

6. **E-Mail testen.** Schick dir selbst eine Nachricht an
   `david@privatklavierunterricht.ch` und löse im Adminbereich eine Mail an
   einen Testschüler aus. Beides muss ankommen. Wenn eingehende Post
   funktioniert, hast du den MX nicht kaputtgemacht.

### In den Tagen danach

**Google Search Console.** Neue Sitemap einreichen:
`https://privatklavierunterricht.ch/sitemap.xml`. Sie entsteht automatisch aus
`src/app/sitemap.ts`.

**Alte Seite noch nicht löschen.** Lass das WordPress-Hosting zwei bis vier
Wochen laufen. Nicht wegen der Website, sondern falls du merkst, dass ein Inhalt
fehlt, den nur dort steht. Danach kündigen.

**Partner informieren.** Das Partnerprogramm fällt weg. Wer einen Zugangscode
hat, findet ab dem Umschalten keine Seite mehr dafür. Offene Provisionen
rechnest du von Hand ab. Schreib den Leuten vorher, nicht nachher.

---

## Danach weiter testen

Die Seite ist dann live, echte Schüler sind darauf. Getestet wird mit dem, was
dafür gebaut ist (Einzelheiten in `docs/Testen.md`):

**Testschüler** sind im ganzen System von echten getrennt. Sie tauchen in der
Routenplanung nicht auf, Planungsrunden lassen sich auf sie beschränken, und ein
Test dazu sorgt dafür, dass diese Trennung nicht aus Versehen wieder verloren
geht.

**Der Mail-Umleiter** ist der Teil, bei dem du aufpassen musst. Setzt du
`EMAIL_REDIRECT_TO` auf deine Adresse, geht **jede** Mail an dich, auch die an
echte Schüler. Zum Ausprobieren eines Ablaufs ist das genau richtig — aber
danach wieder entfernen. Im Adminbereich erscheint ein Warnbanner, solange die
Variable gesetzt ist; das ist die einzige Erinnerung, die du bekommst.

**Vorschau-Deployments:** Jeder Branch bekommt auf Vercel eine eigene URL. Achtung,
die hängt an derselben Datenbank wie die Live-Seite. Zum Anschauen von
Gestaltungsänderungen ideal, zum Ausprobieren von Datenbank-Migrationen nicht.

---

## Wenn etwas schiefgeht

**Seite lädt nicht, Zertifikatsfehler.** Meist Geduld: Vercel stellt das
Zertifikat erst aus, wenn der DNS-Eintrag weltweit sichtbar ist. Bis zu einer
Stunde ist normal.

**Zurück zur alten Seite.** `A` wieder auf `185.125.27.109` setzen. Nach fünf
Minuten ist der alte Zustand da — solange das WordPress-Hosting noch läuft. Das
ist der eigentliche Grund, es nicht sofort zu kündigen.

**Mails kommen nicht mehr an.** Vergleich die DNS-Einträge mit der Tabelle ganz
oben. Am wahrscheinlichsten fehlt `MX` oder `resend._domainkey`.
