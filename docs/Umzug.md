# Umzug: weg von Infomaniak, neue Seite auf Vercel

Stand: 13. August 2026, nachmittags. Alle Werte hier sind ausgelesen, nicht aus
dem Gedächtnis.

---

## Wo wir gerade stehen

| Schritt | Status |
|---|---|
| 1. Zone bei Infomaniak auslesen | **erledigt**, gesichert in `dns-zone-infomaniak-2026-08-13.txt` |
| 2. Zone bei Cloudflare aufbauen | **erledigt**, alle 10 Einträge übernommen und geprüft |
| 3. Nameserver bei GoDaddy umstellen | **offen** — der nächste Schritt |
| 4. Prüfen, dass Website und Mail unverändert laufen | offen |
| 5. Website auf Vercel umbiegen | **wartet auf die Datenübernahme** |

Die Zone liegt fertig bei Cloudflare und tut bis Schritt 3 gar nichts.

---

## Warum die Schritte 3 und 5 getrennt sind

Das ist der Kern des Ganzen, deshalb hier ausdrücklich:

**Schritt 3 ändert die Website nicht.** Der `A`-Eintrag bei Cloudflare zeigt
weiterhin auf `185.125.27.109`, also auf Infomaniak. Es ändert sich nur, *wer*
die Frage „wo liegt diese Domain?" beantwortet. Für Besucher und für E-Mail
bleibt alles, wie es ist.

**Schritt 5 ist der eigentliche Wechsel** — und der wartet, bis die Daten im
neuen System sind. Am 13.08. enthielt die neue Datenbank **null Termine**, und
von sieben echten Schülern hatte einer ein Paket (das eigene Testkonto). Die
Domain jetzt umzubiegen hiesse, Schülern ein Portal ohne Termine, ohne Paket
und ohne Zahlungen vorzusetzen.

---

## Die Zone: was drinsteht und was es tut

Zehn Einträge, bei Cloudflare bereits angelegt und gegen Infomaniak geprüft.

| Name | Typ | Wert | Proxy | wofür |
|---|---|---|---|---|
| `@` | A | `185.125.27.109` | DNS only | Website → **später auf Vercel** |
| `www` | A | `185.125.27.109` | DNS only | dieselbe → **später auf Vercel** |
| `@` | AAAA | `2001:1600:0:aaaa::80:3c` | DNS only | Website über IPv6 → **später auf Vercel** |
| `www` | AAAA | `2001:1600:0:aaaa::80:3c` | DNS only | dieselbe → **später auf Vercel** |
| `@` | MX 10 | `inbound-smtp.eu-west-1.amazonaws.com` | — | eingehende Mail |
| `send` | MX 10 | `feedback-smtp.eu-west-1.amazonses.com` | — | Rückläufer an Resend |
| `@` | TXT | `v=spf1 -all` | — | Absenderprüfung |
| `send` | TXT | `v=spf1 include:amazonses.com ~all` | — | Absenderprüfung Resend |
| `_dmarc` | TXT | `v=DMARC1; p=reject;` | — | Umgang mit gefälschter Post |
| `resend._domainkey` | TXT | `p=MIGf…AQAB` | — | **DKIM: daran hängt der Mailversand** |

Zwei Dinge, die dabei wichtig waren:

**Die AAAA-Einträge.** Von aussen sind sie mir entgangen, in der Zone standen
sie. Beim Wechsel auf Vercel müssen sie mitgezogen werden. Wer nur `A` umbiegt,
schickt alle Besucher mit IPv6 weiterhin auf die alte Seite — und merkt es
nicht, weil man selbst die neue sieht.

**Proxy aus.** Cloudflare hatte die vier Web-Einträge auf „Proxied" gesetzt.
Alle stehen jetzt auf **DNS only**. Bliebe der Proxy an, schöbe sich Cloudflare
zwischen Besucher und Vercel, mit Zertifikatsproblemen als wahrscheinlichster
Folge.

### Warum deine Mails ankommen

`v=spf1 -all` heisst wörtlich: kein Server darf für diese Domain senden.
Trotzdem kommt deine Post durch, weil DMARC zwei Wege kennt und einer reicht:
Resend signiert jede Mail mit dem Schlüssel unter `resend._domainkey`, und die
Signatur passt zur Absenderadresse.

Fehlt dieser eine Eintrag, bleibt nur SPF, und SPF sagt Nein. Bei `p=reject`
heisst das nicht Spam-Ordner, sondern **abgewiesen** — ohne Meldung bei dir.
Deshalb wurde er Zeichen für Zeichen gegen das geprüft, was heute im DNS steht.

---

## Schritt 3: Nameserver umstellen

**Bei GoDaddy** → Domain → DNS → Nameservers → *Change Nameservers*.

Von:

```
ns11.infomaniak.ch
ns12.infomaniak.ch
```

auf:

```
giancarlo.ns.cloudflare.com
mary.ns.cloudflare.com
```

**Bei Infomaniak nichts löschen.** Bis alle Auflöser weltweit umgestellt haben,
können ein bis zwei Tage vergehen, und in dieser Zeit beantwortet teils noch
Infomaniak. Die Zone dort muss also stehen bleiben und identisch sein. Sie ist
ausserdem der Rückweg: Nameserver zurücksetzen, und nach kurzer Zeit ist der
alte Zustand da.

### Schritt 4: prüfen, dass sich nichts geändert hat

Nach ein paar Stunden, spätestens am Folgetag:

1. `https://privatklavierunterricht.ch` zeigt die **alte** Seite. Richtig so.
2. Eine Mail an `david@privatklavierunterricht.ch` schicken. Kommt sie an,
   steht der MX.
3. Im Adminbereich eine Mail an einen Testschüler auslösen. Kommt sie an,
   stehen DKIM und die `send`-Einträge.

Erst wenn alle drei stimmen, ist Schritt 3 abgeschlossen.

---

## Schritt 5: Website auf Vercel (später)

Voraussetzung: Die Daten sind im neuen System.

1. Vercel → Projekt → Settings → Domains → `privatklavierunterricht.ch` und
   `www.privatklavierunterricht.ch` hinzufügen. Die Domain ohne `www` ist die
   Hauptadresse; alle `canonical`-Angaben und `metadataBase` im Code zeigen
   dorthin. `www` soll auf sie umleiten, nicht umgekehrt.
2. Vercel zeigt die konkreten Zielwerte an. **Die aus dem eigenen Dashboard
   nehmen** — sie sind teils projektspezifisch, und die Zahlen aus älteren
   Anleitungen im Netz stimmen nicht mehr durchgehend.
3. Bei Cloudflare die Web-Einträge ändern. Proxy bleibt aus.

   **Zu den beiden AAAA-Einträgen:** Nennt Vercel nur eine IPv4-Adresse, dann
   werden `AAAA` für `@` und `www` **gelöscht**, nicht umgebogen. Ein
   AAAA-Eintrag, der noch auf Infomaniak zeigt, schickt jeden Besucher mit
   IPv6 weiterhin auf die alte Seite — und Mobilfunknetze in der Schweiz sind
   überwiegend IPv6. Ohne AAAA fallen diese Besucher sauber auf IPv4 zurück.
   Nennt Vercel eine IPv6-Adresse, werden sie stattdessen darauf gesetzt.

4. Fünf Minuten warten, dann prüfen: neue Seite da, Schloss im Browser zu.
5. **`NEXT_PUBLIC_APP_URL` auf `https://privatklavierunterricht.ch` ändern und
   neu bereitstellen.** Bis dahin steht dort `https://privatklavierunterricht.vercel.app`,
   und dieser Wert steckt in jedem Link in jeder E-Mail, in der Sitemap und in
   der robots.txt. Ohne diesen Schritt läuft die Seite unter der Domain,
   verweist aber überall auf sich selbst unter der alten Adresse.

Vorher auf Vercel kontrollieren (Production):

| Variable | Wert |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://privatklavierunterricht.ch` |
| `EMAIL_REDIRECT_TO` | **gelöscht** (am 13.08. entfernt) |

`EMAIL_FROM` ist nicht gesetzt und muss es auch nicht sein: Ohne die Variable
greift der Vorgabewert `david@privatklavierunterricht.ch`.

`EMAIL_REDIRECT_TO` ist der gefährlichste Schalter. Solange er gesetzt ist,
bekommt **kein Schüler Post**, alles landet bei dir. Im Adminbereich erscheint
dazu ein Warnbanner; das ist die einzige Erinnerung, die du bekommst.

> **Achtung, häufige Falle:** Eine geänderte oder gelöschte Variable wirkt
> **erst mit dem nächsten Deployment**. Vercel sagt das beim Speichern in
> einem Hinweis, den man leicht wegklickt.

### Alte Adressen

Sind in `next.config.ts` umgeleitet und am laufenden Server geprüft:

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

---

## Danach

**Infomaniak nicht sofort kündigen.** Zwei bis vier Wochen laufen lassen.
Solange die alte Seite unter `185.125.27.109` erreichbar ist, bist du mit einer
Änderung der A-Einträge in Minuten wieder im alten Zustand.

**Google Search Console:** neue Sitemap einreichen,
`https://privatklavierunterricht.ch/sitemap.xml`.

**Partner informieren.** Das Partnerprogramm fällt weg. Wer einen Zugangscode
hat, findet danach keine Seite mehr dafür. Offene Provisionen von Hand
abrechnen, und zwar **vorher** schreiben.

---

## Wenn etwas schiefgeht

| Symptom | erste Vermutung |
|---|---|
| Mails kommen nicht mehr **an** | `MX` am Hauptnamen fehlt |
| Mails gehen nicht mehr **raus** bzw. werden abgewiesen | `resend._domainkey` fehlt oder ist verfälscht |
| Ein Teil der Besucher sieht die alte Seite | `AAAA` nicht mitgezogen |
| Zertifikatsfehler nach dem Vercel-Wechsel | Geduld, oder Proxy versehentlich an |
| Alles kaputt, Ursache unklar | Nameserver bei GoDaddy zurück auf `ns11`/`ns12.infomaniak.ch` |
