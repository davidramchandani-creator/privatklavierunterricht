# Umzug: weg von Infomaniak, neue Seite auf Vercel

Stand: 13. August 2026. Alle DNS-Werte hier sind ausgelesen, nicht aus dem
Gedächtnis. Bevor du etwas änderst: bitte einmal ganz lesen, besonders
Abschnitt 1.

---

## Wie es heute aussieht

Drei Dinge, die oft verwechselt werden, liegen bei dir an drei Stellen:

| | wo | ändert sich |
|---|---|---|
| **Registrar** — wem die Domain gehört | GoDaddy | nein |
| **DNS** — wer die Fragen zur Domain beantwortet | Infomaniak (`ns11`/`ns12.infomaniak.ch`) | **ja** |
| **Hosting** — wo die Website liegt | Infomaniak (`185.125.27.109`) | **ja** |

DNSSEC ist nicht aktiv. Das ist eine gute Nachricht: Ein Nameserver-Wechsel
mit aktivem DNSSEC kann die Domain für Stunden unerreichbar machen, wenn man
die Reihenfolge falsch macht. Diese Falle entfällt.

---

## 1. Der Teil, an dem der Umzug scheitern kann

Bei einem reinen Hosting-Wechsel ändert man einen Eintrag. Du wechselst aber
den **DNS-Anbieter**, und das heisst: Die komplette Zone wird woanders neu
aufgebaut. Alles, was Infomaniak heute beantwortet und du nicht abschreibst,
ist danach weg.

Und das Meiste davon hat mit der Website nichts zu tun. **An dieser Domain
hängt dein gesamter Mailverkehr.**

Was ich von aussen sehen kann:

| Name | Typ | Wert | wofür |
|---|---|---|---|
| `@` | A | `185.125.27.109` | alte Website → **wird ersetzt** |
| `www` | A | `185.125.27.109` | dieselbe → **wird ersetzt** |
| `@` | MX | `10 inbound-smtp.eu-west-1.amazonaws.com` | **eingehende Mail** |
| `@` | TXT | `v=spf1 -all` | Absenderprüfung |
| `_dmarc` | TXT | `v=DMARC1; p=reject;` | Umgang mit gefälschter Post |
| `resend._domainkey` | TXT | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDR3ue4iTgC91fYs6CKpFHJ0yfnbbDkjIKSdq3PNOWM895ynkmwvYYYtYCM1A+zysnFyyG5C3DOwWsSJDROdJER0/11J455OoSXNWG1UrajrCjIDTPWfyvH+NFOYSill7jnq9CmyXGq7/iqNqDM9R5iJi1WHz5gJ9BwYp6uQLxNlQIDAQAB` | **DKIM-Signatur von Resend** |
| `send` | MX | `10 feedback-smtp.eu-west-1.amazonses.com` | Rückläufer an Resend |
| `send` | TXT | `v=spf1 include:amazonses.com ~all` | Absenderprüfung für Resend |

> **Exportier trotzdem die Zone bei Infomaniak.** Diese Tabelle ist das, was
> ich von aussen abfragen konnte. Einträge, deren Namen ich nicht erraten
> habe, sehe ich nicht — DNS lässt sich nicht durchblättern. Infomaniak bietet
> im DNS-Bereich einen Export der Zonendatei. Der ist vollständig, meine
> Tabelle ist es vielleicht nicht.

### Warum deine Mails ankommen, und wie leicht das kaputtgeht

Das musst du verstanden haben, bevor du Einträge abtippst.

Dein SPF am Hauptnamen lautet `v=spf1 -all`. Wörtlich: *kein* Server darf für
diese Domain senden. Trotzdem kommen deine Mails an, weil DMARC zwei Wege
kennt und einer reicht: Resend signiert jede Mail mit dem Schlüssel, der unter
`resend._domainkey` steht, und diese Signatur passt zur Absenderadresse.

Fehlt dieser eine TXT-Eintrag nachher, bleibt nur SPF, und SPF sagt Nein. Bei
`p=reject` heisst das nicht Spam-Ordner, sondern **abgewiesen**. Deine
Terminbestätigungen und Rechnungen kämen nicht mehr an, und du bekämst davon
keine Meldung.

Der DKIM-Wert ist lang und besteht aus zufälligen Zeichen. Genau dort passieren
Abschreibfehler. Kopieren, nicht tippen, und danach kontrollieren.

---

## 2. Wo soll DNS künftig liegen?

**Empfehlung: GoDaddy**, also beim Registrar. Die Website bleibt bei Vercel,
nur DNS nicht.

### Warum nicht einfach alles zu Vercel?

Das ist die naheliegende Frage, wenn man ohnehin täglich dort deployt. Der
erwartete Vorteil tritt aber nicht ein. Vercels eigene Dokumentation:

> If you are verifying your domain by changing nameservers, you will need to
> add any DNS records to Vercel that you wish to keep from your previous DNS
> provider.

Also: **Alle acht Mail-Einträge müsstest du auch dort von Hand anlegen**, DKIM
inklusive. Vercel-Nameserver ersparen dir genau die zwei Einträge für die
Website — und die fasst du einmal an und danach nie wieder.

Was du dir dafür einhandelst, ist dauerhaft:

- Dein Mailverkehr hängt am Hosting-Konto. Wechselst du je den Hoster, baust du
  die ganze Zone erneut auf. Also genau das, was du gerade machst.
- Ein Problem mit dem Vercel-Konto (Zahlung, Sperre, Ausfall) nähme dir nicht
  nur die Website, sondern über DNS auch die Mail. Unwahrscheinlich, aber der
  Schaden wäre gross und die Ursache schwer zu finden.

Für eine Website ist der zweite Punkt Theorie. Für den Kanal, über den
Terminbestätigungen und Rechnungen laufen, ist er es nicht.

### Ein Punkt spricht doch für Vercel

Der Vollständigkeit halber, damit du selbst abwägen kannst: GoDaddy bietet am
Hauptnamen (ohne `www`) nur einen `A`-Eintrag, also eine feste IP-Adresse.
Ändert Vercel diese Adresse irgendwann, musst du sie von Hand nachziehen.
Vercel kündigt so etwas an, und es kommt selten vor — aber es ist Handarbeit,
die bei Vercel-Nameservern entfiele.

### Und wenn du dir das Abtippen sparen willst

**Cloudflare** (kostenlos) liest die bestehende Zone beim Einrichten selbst ein.
Damit entfällt genau das Risiko, das bei diesem Umzug am grössten ist: einen
Eintrag zu übersehen, den weder du noch ich auf dem Zettel haben. Ausserdem
löst es den Punkt oben, weil dort auch am Hauptnamen ein `CNAME` möglich ist.

Der Preis ist ein dritter Anbieter im Spiel.

**Kurz:** GoDaddy, wenn du wenige Konten willst. Cloudflare, wenn du den Umzug
selbst so sicher wie möglich machen willst. Vercel-Nameserver würde ich nicht
nehmen — nicht weil es schlecht wäre, sondern weil es die Arbeit nicht spart,
für die man es nimmt.

---

## 3. Der Ablauf

Der entscheidende Kniff: **Nicht beides gleichzeitig ändern.** Erst zieht die
Zone um, ohne dass sich inhaltlich etwas ändert. Erst wenn das nachweislich
läuft, zeigt die Website woanders hin. Geht etwas schief, weisst du dann auch,
woran es lag.

### Schritt 1 — Zone bei Infomaniak exportieren

DNS-Bereich öffnen, Zonendatei exportieren oder alle Einträge abfotografieren.
**Das ist deine Sicherung.** Ohne sie gibt es keinen Weg zurück, wenn du später
merkst, dass ein Eintrag fehlt.

### Schritt 2 — Zone bei GoDaddy aufbauen, unverändert

Bei GoDaddy unter *DNS verwalten* alle Einträge aus der Tabelle oben anlegen.
Die `A`-Einträge zeigen dabei **noch auf `185.125.27.109`**, also weiter auf
Infomaniak.

Klingt unnötig. Ist es nicht: Damit ist die neue Zone eine exakte Kopie, und der
Nameserver-Wechsel im nächsten Schritt ändert für Besucher und Mail gar nichts.
Fällt dabei etwas aus, liegt es sicher an der Zone und nicht an Vercel.

TTL überall auf **300 Sekunden** (5 Minuten) stellen, solange der Umzug läuft.
Später kannst du das wieder hochsetzen.

### Schritt 3 — Nameserver bei GoDaddy umstellen

Von `ns11.infomaniak.ch` / `ns12.infomaniak.ch` auf GoDaddys eigene Nameserver.

Das ist der einzige Schritt, der länger dauert: Bis alle Auflöser weltweit die
neuen Nameserver benutzen, können ein bis zwei Tage vergehen. In dieser Zeit
beantworten teils noch Infomaniaks Server die Fragen — deshalb muss die Zone
dort **unverändert stehen bleiben** und identisch sein. Lösch bei Infomaniak
jetzt noch nichts.

### Schritt 4 — Prüfen, dass sich nichts geändert hat

Warte einen Tag. Dann:

- `https://privatklavierunterricht.ch` zeigt die **alte** Seite. Richtig so.
- Schick dir eine Mail an `david@privatklavierunterricht.ch`. Kommt sie an,
  steht der MX.
- Lös im Adminbereich eine Mail an einen Testschüler aus. Kommt sie an, stehen
  DKIM und die `send`-Einträge.

Erst wenn diese drei Punkte stimmen, geht es weiter. Wenn nicht: Nameserver
zurück auf Infomaniak, dann ist der alte Zustand wieder da.

### Schritt 5 — Website auf Vercel umstellen

1. In Vercel: Projekt → Settings → Domains → `privatklavierunterricht.ch` und
   `www.privatklavierunterricht.ch` hinzufügen.
2. Vercel zeigt dir dann die konkreten Werte an: eine IP für den `A`-Eintrag am
   Hauptnamen und ein Ziel für `www`. **Nimm die Werte aus deinem Dashboard.**
   Sie sind teils projektspezifisch, und die Zahlen, die in älteren Anleitungen
   im Netz stehen, stimmen nicht mehr durchgehend.
3. Bei GoDaddy nur diese beiden Zeilen ändern. Alles andere bleibt.
4. Nach fünf Minuten prüfen: neue Seite da, Schloss im Browser zu. Das
   Zertifikat stellt Vercel selbst aus, das kann eine halbe Stunde länger
   dauern als die Umstellung.

### Schritt 6 — Alte Adressen stichprobenweise aufrufen

Sie sind in `next.config.ts` umgeleitet und am laufenden Server geprüft:

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

## 4. Vor dem Umschalten auf Vercel kontrollieren

Diese Variablen müssen für *Production* gesetzt sein:

| Variable | Wert |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://privatklavierunterricht.ch` |
| `EMAIL_FROM` | `david@privatklavierunterricht.ch` |
| `EMAIL_REDIRECT_TO` | **leer oder gelöscht** |

Der letzte ist der gefährlichste. Solange `EMAIL_REDIRECT_TO` gesetzt ist,
bekommt **kein Schüler Post** — alles landet bei dir. Beim Testen richtig, im
Betrieb eine Panne, die tagelang unbemerkt bleibt. Im Adminbereich erscheint
dazu ein Warnbanner; das ist die einzige Erinnerung, die du bekommst.

---

## 5. Danach

**Infomaniak noch nicht kündigen.** Zwei bis vier Wochen laufen lassen. Solange
die alte Seite unter `185.125.27.109` erreichbar ist, bist du mit einer
Änderung des `A`-Eintrags in fünf Minuten wieder im alten Zustand. Das ist dein
Rückweg, und er kostet einen Monat Hosting.

**Google Search Console:** neue Sitemap einreichen,
`https://privatklavierunterricht.ch/sitemap.xml`.

**Partner informieren.** Das Partnerprogramm fällt weg. Wer einen Zugangscode
hat, findet danach keine Seite mehr dafür. Offene Provisionen von Hand
abrechnen. Schreib den Leuten **vorher**.

**TTL wieder hochsetzen**, wenn alles läuft — 3600 statt 300.

---

## 6. Weiter testen, wenn echte Schüler drauf sind

Getestet wird mit dem, was dafür gebaut ist; Einzelheiten in `docs/Testen.md`.

**Testschüler** sind im ganzen System von echten getrennt. Sie tauchen in der
Routenplanung nicht auf, Planungsrunden lassen sich auf sie beschränken, und
ein Test sorgt dafür, dass diese Trennung nicht unbemerkt verloren geht.

**Der Mail-Umleiter** ist der Teil, bei dem du aufpassen musst: `EMAIL_REDIRECT_TO`
auf deine Adresse setzen, ausprobieren, **wieder entfernen**.

**Vorschau-Deployments** bekommen auf Vercel eine eigene URL, hängen aber an
derselben Datenbank wie die Live-Seite. Für Gestaltungsänderungen ideal, für
Datenbank-Migrationen nicht.

---

## Wenn etwas schiefgeht

| Symptom | erste Vermutung |
|---|---|
| Seite lädt nicht, Zertifikatsfehler | Geduld. Vercel stellt das Zertifikat erst aus, wenn der Eintrag weltweit sichtbar ist. |
| Mails kommen nicht mehr **an** | `MX` am Hauptnamen fehlt oder ist falsch. |
| Mails gehen nicht mehr **raus** bzw. werden abgewiesen | `resend._domainkey` fehlt oder wurde falsch kopiert. Häufigster Fehler. |
| Alles kaputt, Ursache unklar | Nameserver bei GoDaddy zurück auf `ns11.infomaniak.ch` / `ns12.infomaniak.ch`. Deshalb wird dort nichts gelöscht. |
