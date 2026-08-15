-- ============================================================
-- Bewertungen
--
-- Bisher standen die Bewertungen als feste Liste im Code. Das ging, solange
-- sie sich nie änderten. Sobald Schüler selbst eine abgeben sollen, müsste
-- für jede einzelne jemand den Code anfassen und neu ausliefern.
--
-- Zwei Tabellen, weil es zwei verschiedene Dinge sind:
--
--   **reviews** ist die Bewertung selbst. Sie entsteht erst, wenn jemand
--   das Formular abschickt.
--
--   **review_einladungen** ist die Aufforderung dazu. Sie entsteht, wenn
--   David auf den Knopf drückt, und trägt den Token für den Link in der
--   Mail. Beides in eine Tabelle zu legen hiesse, für jede verschickte Mail
--   eine leere Bewertung anzulegen, die vielleicht nie ausgefüllt wird.
--
-- ── Warum nichts sofort erscheint ───────────────────────────
--
-- Neue Bewertungen stehen auf 'offen' und sind auf der Website unsichtbar,
-- bis David sie freigibt. Der Grund ist nicht Misstrauen gegenüber den
-- Schülern, sondern dass der Link in der Mail ohne Login funktioniert:
-- Wer ihn weiterleitet, könnte sonst ungefragt auf die Startseite schreiben.
-- ============================================================

-- === Die Bewertungen ================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),

  -- Bleibt erhalten, wenn das Schülerkonto einmal gelöscht wird: Die
  -- Bewertung gehört dann niemandem mehr, verschwindet aber nicht.
  student_id uuid references public.profiles(id) on delete set null,

  -- Nur der Vorname, so wie überall auf der Seite.
  name text,

  sterne smallint not null check (sterne between 1 and 5),

  -- Der volle Wortlaut, unverändert wie abgeschickt.
  text text,

  -- Die gekürzte Fassung für die Karten auf der Startseite. Wird von Hand
  -- gesetzt und lässt ausschliesslich weg. Fehlt sie, steht überall der
  -- volle Text.
  text_kurz text,

  status text not null default 'offen'
    check (status in ('offen', 'freigegeben', 'abgelehnt')),

  -- Woher sie stammt. Nur zur Nachvollziehbarkeit, die Anzeige
  -- unterscheidet nicht.
  quelle text not null default 'formular'
    check (quelle in ('formular', 'website_alt', 'matchspace', 'admin')),

  -- Kleinere Zahl steht weiter vorne. Gleiche Zahl: nach Datum.
  reihenfolge int not null default 100,

  created_at timestamptz not null default now(),
  freigegeben_am timestamptz
);

-- Ein Name ohne Text ist in Ordnung, ein Text ohne Namen nicht: Ein Zitat
-- ohne Absender wirkt erfunden.
do $$ begin
  alter table public.reviews
    add constraint reviews_text_braucht_namen
    check (text is null or (name is not null and length(trim(name)) > 0));
exception when duplicate_object then null; end $$;

-- Die Kurzfassung darf nicht länger sein als das Original. Sonst wurde
-- etwas hinzugedichtet statt weggelassen.
do $$ begin
  alter table public.reviews
    add constraint reviews_kurz_ist_kuerzer
    check (text_kurz is null or (text is not null and length(text_kurz) <= length(text)));
exception when duplicate_object then null; end $$;

create index if not exists reviews_sichtbar
  on public.reviews (reihenfolge, created_at)
  where status = 'freigegeben';

create index if not exists reviews_offen
  on public.reviews (created_at)
  where status = 'offen';

comment on column public.reviews.text_kurz is
  'Gekürzte Fassung für die Startseite. Es wird weggelassen, nie umformuliert.';

-- === Die Einladungen ================================================

create table if not exists public.review_einladungen (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,

  -- Steht im Link in der Mail. Zufällig, weil er ohne Login gilt.
  token uuid not null unique default gen_random_uuid(),

  created_at timestamptz not null default now(),

  -- Gesetzt, sobald das Formular abgeschickt wurde. Danach ist der Link
  -- verbraucht: Ein zweiter Aufruf zeigt einen Dank, kein leeres Formular.
  benutzt_am timestamptz,
  review_id uuid references public.reviews(id) on delete set null
);

-- Höchstens eine offene Einladung pro Schüler. Ohne das bekommt jemand bei
-- jedem Klick auf den Knopf eine weitere Mail zur selben Sache, und jeder
-- der Links funktioniert.
create unique index if not exists review_einladungen_eine_offene
  on public.review_einladungen (student_id)
  where benutzt_am is null;

create index if not exists review_einladungen_token
  on public.review_einladungen (token);

-- === Zugriff ========================================================

alter table public.reviews enable row level security;
alter table public.review_einladungen enable row level security;

drop policy if exists "Nur Admin verwaltet Bewertungen" on public.reviews;
create policy "Nur Admin verwaltet Bewertungen" on public.reviews
  for all using (is_admin()) with check (is_admin());

-- Freigegebene Bewertungen darf jeder lesen, auch ohne Login: Sie stehen
-- ja auf der öffentlichen Startseite.
drop policy if exists "Alle lesen freigegebene Bewertungen" on public.reviews;
create policy "Alle lesen freigegebene Bewertungen" on public.reviews
  for select using (status = 'freigegeben');

drop policy if exists "Nur Admin verwaltet Einladungen" on public.review_einladungen;
create policy "Nur Admin verwaltet Einladungen" on public.review_einladungen
  for all using (is_admin()) with check (is_admin());

-- Bewusst keine Regel, die Fremden das Schreiben erlaubt. Das Formular
-- läuft serverseitig über den Admin-Zugang und prüft den Token selbst.
-- Eine Insert-Regel für anonyme Besucher wäre eine offene Tür, hinter der
-- nur die Kenntnis einer Tabellenstruktur steht.

-- === Die bisherigen Bewertungen ====================================
--
-- Idempotent über den Namen: Ein zweiter Lauf legt nichts doppelt an.

insert into public.reviews (name, sterne, text, text_kurz, status, quelle, reihenfolge, freigegeben_am)
select v.name, 5, v.text, v.text_kurz, 'freigegeben', v.quelle, v.reihenfolge, now()
from (values
  ('Jan',
   'Perfekt! David ist ein sehr engagierter Klavierlehrer. Er unterrichtet meine zwei Kinder seit gut einem halben Jahr wöchentlich. Die Kinder fühlen sich super wohl mit ihm, haben Freude am Klavier spielen und machen tolle Fortschritte. David ist professionell, kommuniziert super und er ist sehr zuverlässig. Wir können ihn von Herzen weiterempfehlen :).',
   'David ist ein sehr engagierter Klavierlehrer. Er unterrichtet meine zwei Kinder seit gut einem halben Jahr wöchentlich. Die Kinder fühlen sich super wohl mit ihm, haben Freude am Klavier spielen und machen tolle Fortschritte. Wir können ihn von Herzen weiterempfehlen.',
   'website_alt', 10),
  ('Pierre',
   'Ich gehe zu ihm in die Stunden was ich keinen Moment bereue. Er hat eine sehr angenehme Art und Weise mir genau da zu helfen wo ich seine Hilfe benötige. Sehr vertrauenswürdige Lektionen auf schon fast kollegialer Basis, was ich enorm schätze. Toller Prof!',
   'Er hat eine sehr angenehme Art und Weise mir genau da zu helfen wo ich seine Hilfe benötige. Sehr vertrauenswürdige Lektionen auf schon fast kollegialer Basis. Toller Prof!',
   'website_alt', 20),
  ('Julian',
   'David spielt schon seit Kindheit Klavier und ich bin jedes mal überrascht wenn ich ihn spielen höre wie exakt und präzise er die Töne spielt. Er ist ein sehr geduldiger Mensch und kann einem sehr viel beibringen auf dem Klavier. mit David hat man einen sehr guten, jungen Klavierlehrer der professionell und auf moderne Art und Weise Klavierunterricht erteilt.',
   'Er ist ein sehr geduldiger Mensch und kann einem sehr viel beibringen auf dem Klavier. mit David hat man einen sehr guten, jungen Klavierlehrer der professionell und auf moderne Art und Weise Klavierunterricht erteilt.',
   'website_alt', 30),
  ('Mirela',
   'David ist eine natürliche und feine Persönlichkeit. Er verfügt über sehr gute Sozial- und Selbstkompetenzen. Er unterrichtet mit Leidenschaft und Respekt für Klavier und Mitmenschen! Wir würden David jeder Zeit sehr gerne weiterempfehlen. DANKE DAVID!',
   'David ist eine natürliche und feine Persönlichkeit. Er unterrichtet mit Leidenschaft und Respekt für Klavier und Mitmenschen! Wir würden David jeder Zeit sehr gerne weiterempfehlen.',
   'matchspace', 40),
  ('Flurina',
   'Wir sind sehr begeistert von David. Er ist sehr geduldig, kompetent und man spürt die Leidenschaft für seine Aufgabe. Unser Sohn freut sich jeweils sehr auf die Klavierstunden. Wir können David zu 100% weiterempfehlen.',
   'Er ist sehr geduldig, kompetent und man spürt die Leidenschaft für seine Aufgabe. Unser Sohn freut sich jeweils sehr auf die Klavierstunden. Wir können David zu 100% weiterempfehlen.',
   'matchspace', 50),
  ('Marina',
   'Wir haben Spass zusammen zu spielen und zu lernen.',
   null,
   'website_alt', 60)
) as v(name, text, text_kurz, quelle, reihenfolge)
where not exists (
  select 1 from public.reviews r where r.name = v.name and r.text is not null
);

-- Die zwei Fünf-Sterne-Wertungen aus dem alten System, die niemand
-- kommentiert hat. Sie zählen in Schnitt und Anzahl mit, bekommen aber
-- keine Karte: Ein leeres Zitatfeld sieht nach Fehler aus, nicht nach
-- Zurückhaltung.
insert into public.reviews (name, sterne, text, status, quelle, reihenfolge, freigegeben_am)
select null, 5, null, 'freigegeben', 'website_alt', 900, now()
from generate_series(1, 2)
where not exists (
  select 1 from public.reviews r where r.text is null and r.quelle = 'website_alt' and r.name is null
);
