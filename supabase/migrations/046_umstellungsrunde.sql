-- ============================================================
-- Umstellungsrunde: vom Paket aufs Abo
-- Angewendet am 2026-08-19.
--
-- Eine Planungsrunde fragte bisher nur nach Zeiten. Das genügt für den
-- Normalfall: Wer schon ein Abo hat, braucht nur noch einen Termin.
--
-- Bei der Umstellung ist es umgekehrt. Es gibt noch gar kein Abo, und die
-- Frage nach der Zeit kommt erst an zweiter Stelle. Zuerst muss der Schüler
-- sagen, welches Abo er überhaupt will, denn davon hängt alles Weitere ab:
-- Laufzeit, Lektionszahl, Preis und die Zahl der Termine, die gebucht werden.
--
-- Deshalb bekommt die Runde eine Art. 'termine' ist die bisherige Runde und
-- bleibt unverändert; 'umstellung' fragt zusätzlich nach dem Abo.
--
-- ── Warum ein eigenes Aktivierungsdatum ─────────────────────
--
-- Die Frist ist der Tag, bis zu dem geantwortet werden muss. Der Start ist
-- der Tag, an dem die Abos laufen. Das sind zwei verschiedene Daten, und sie
-- müssen es sein: David fragt drei Wochen vorher, damit er den Stundenplan
-- rechnen und prüfen kann, bevor irgendetwas gebucht wird.
--
-- Ohne dieses Feld müsste er den Start beim Anwenden von Hand eintippen, an
-- genau der Stelle, an der ein Vertipper 20 Termine auf ein falsches Datum
-- legt.
-- ============================================================

alter table public.planungsrunden
  add column if not exists art text not null default 'termine',
  add column if not exists start_datum date;

do $$ begin
  alter table public.planungsrunden
    add constraint planungsrunden_art_check
    check (art in ('termine', 'umstellung'));
exception when duplicate_object then null; end $$;

-- Eine Umstellungsrunde ohne Startdatum wäre sinnlos: Es gäbe keinen Tag,
-- auf den die Abos gelegt werden könnten. Die Datenbank hält das fest,
-- damit es nicht nur im Formular geprüft wird.
do $$ begin
  alter table public.planungsrunden
    add constraint planungsrunden_umstellung_braucht_start
    check (art <> 'umstellung' or start_datum is not null);
exception when duplicate_object then null; end $$;

comment on column public.planungsrunden.art is
  'termine = nur Zeiten abfragen. umstellung = zusätzlich Abo wählen lassen und beim Anwenden anlegen.';
comment on column public.planungsrunden.start_datum is
  'Tag, an dem die Abos beginnen. Nicht zu verwechseln mit der Frist zum Antworten.';

-- === Die Wahl des Schülers ==========================================
--
-- Sie steht bei der Antwort, nicht in einer eigenen Tabelle: Es ist genau
-- eine Wahl pro Schüler und Runde, und die Antwortzeile gibt es ohnehin
-- schon. Eine zweite Tabelle wäre eine 1:1-Beziehung mit Extraarbeit.

alter table public.planungs_antworten
  add column if not exists abo_variante text,
  add column if not exists abo_rhythmus text,
  -- Was der Schüler beim Absenden bestätigt hat, mit Zeitstempel. Ohne das
  -- lässt sich später nicht mehr zeigen, dass er die Bedingungen gesehen
  -- hat, und genau darum geht es bei einer Bestätigung.
  add column if not exists bestaetigt_am timestamptz;

do $$ begin
  alter table public.planungs_antworten
    add constraint planungs_antworten_variante_check
    check (abo_variante is null or abo_variante in ('halbjahr', 'jahr'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.planungs_antworten
    add constraint planungs_antworten_rhythmus_check
    check (abo_rhythmus is null or abo_rhythmus in ('woechentlich', 'zweiwoechentlich'));
exception when duplicate_object then null; end $$;

-- Halbe Angaben wären schlimmer als gar keine: Der Planer würde mit einem
-- Rhythmus rechnen, ohne zu wissen, wie lange das Abo laufen soll.
do $$ begin
  alter table public.planungs_antworten
    add constraint planungs_antworten_wahl_vollstaendig
    check ((abo_variante is null) = (abo_rhythmus is null));
exception when duplicate_object then null; end $$;

comment on column public.planungs_antworten.abo_variante is
  'Nur bei Umstellungsrunden gefüllt: halbjahr oder jahr.';
comment on column public.planungs_antworten.bestaetigt_am is
  'Wann der Schüler die Bedingungen bestätigt hat. Grundlage der Vertragsbestätigung.';
