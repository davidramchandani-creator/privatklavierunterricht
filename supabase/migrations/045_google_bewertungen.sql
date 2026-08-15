-- ============================================================
-- Bewertungen von Google
--
-- Zwei Stimmen standen bisher nur im Google-Profil. Sie gehören auch auf
-- die Website: Wer dort landet, geht nicht erst zu Google, um nachzusehen,
-- ob es noch mehr gibt.
--
-- Neue Herkunft 'google', damit im Admin sichtbar bleibt, woher eine
-- Bewertung stammt. Für die Anzeige macht das keinen Unterschied.
--
-- ── Zu Marina ───────────────────────────────────────────────
--
-- Sie stand schon mit einem Einzeiler aus dem alten System in der Liste
-- („Wir haben Spass zusammen zu spielen und zu lernen"). Es ist dieselbe
-- Person, die bei Google ausführlicher geschrieben hat. Zwei Karten mit
-- demselben Vornamen hätten wie zwei Personen ausgesehen, deshalb ersetzt
-- der neue Text den alten, statt danebenzustehen.
--
-- ── Zur Rechtschreibung ─────────────────────────────────────
--
-- Nadine schreibt „kompotenter". Das bleibt so. Es gilt dieselbe Regel wie
-- für Julians kleingeschriebenes „mit": Es wird weggelassen, nie
-- korrigiert. Wer Tippfehler glattzieht, hat gleich auch den Satzbau
-- verbessert, und am Ende klingen alle Bewertungen wie derselbe Texter.
-- ============================================================

do $$ begin
  alter table public.reviews drop constraint if exists reviews_quelle_check;
  alter table public.reviews
    add constraint reviews_quelle_check
    check (quelle in ('formular', 'website_alt', 'matchspace', 'google', 'admin'));
end $$;

-- Marina: derselbe Mensch, ausführlicherer Text. Die Signaturzeile
-- „Marina Davies" aus dem Google-Text fällt weg, sie steht als Name
-- ohnehin unter der Karte.
update public.reviews
set text = 'Best teacher ever! Sehr geduldig und viel Erfahrung',
    text_kurz = null,
    quelle = 'google'
where name = 'Marina'
  and text = 'Wir haben Spass zusammen zu spielen und zu lernen.';

insert into public.reviews (name, sterne, text, status, quelle, reihenfolge, freigegeben_am)
select v.name, 5, v.text, 'freigegeben', 'google', v.reihenfolge, now()
from (values
  ('Nadine',
   'David ist ein geduldiger, freundlicher und kompotenter Lehrer. Unsere Tochter hat in kurzer Zeit grosse Fortschritte gemacht. Vielen Dank',
   35)
) as v(name, text, reihenfolge)
where not exists (
  select 1 from public.reviews r where r.name = v.name and r.quelle = 'google'
);

-- ── Nachtrag: Flurina ───────────────────────────────────────
--
-- Bei Google fand sich eine dritte Bewertung, die beim ersten Blick
-- untergegangen war: wieder von Flurina, aber ein anderer Text als der bei
-- Matchspace. Dieselbe Person, zwei Plattformen, zwei Formulierungen.
--
-- Zwei Karten mit demselben Vornamen haetten wie zwei Personen ausgesehen.
-- Es bleibt deshalb bei einer, mit dem Google-Text: dieselbe Entscheidung
-- wie bei Marina, aus demselben Grund.
update public.reviews
set text = 'David versteht es, seinen Unterricht sehr motivierend, interessant und lehrreich zu gestalten. Er hat ein sehr gutes Gespür für Jugendliche. Die Organisation und Durchführung der Stunden klappt einwandfrei. Wir können David zu 100 Prozent weiterempfehlen.',
    text_kurz = 'David versteht es, seinen Unterricht sehr motivierend, interessant und lehrreich zu gestalten. Er hat ein sehr gutes Gespür für Jugendliche. Wir können David zu 100 Prozent weiterempfehlen.',
    quelle = 'google'
where name = 'Flurina' and quelle = 'matchspace';
