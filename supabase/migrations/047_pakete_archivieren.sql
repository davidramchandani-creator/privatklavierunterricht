-- ============================================================
-- Alte Pakete aus dem Weg räumen
-- Angewendet am 2026-08-20.
--
-- Nach einem halben Jahr Betrieb stehen unter jedem Schüler fünf oder mehr
-- Zeilen, von denen genau eine zählt. Die alten wegzulassen geht nicht: Sie
-- gehören zur Geschichte, an ihnen hängen Rechnungen, und manchmal muss man
-- nachsehen, was damals vereinbart war.
--
-- ── Warum kein weiterer Status ──────────────────────────────
--
-- „archiviert" wäre der naheliegende sechste Status neben active, cancelled,
-- expired und so weiter. Er wäre aber etwas anderes als die übrigen: Die
-- beschreiben, was mit dem Paket passiert ist, dieses beschriebe, ob David es
-- noch sehen will. Beides in ein Feld zu legen hiesse, dass beim Archivieren
-- die Information verloren geht, ob das Paket storniert oder abgelaufen war.
--
-- Deshalb ein eigenes Datum. Es steht quer zum Status, und man sieht ihm an,
-- wann aufgeräumt wurde.
-- ============================================================

alter table public.packages
  add column if not exists archiviert_am timestamptz;

comment on column public.packages.archiviert_am is
  'Aus der Übersicht ausgeblendet. Sagt nichts darüber aus, wie das Paket geendet hat, das steht in status.';

-- Ein aktives Paket zu archivieren wäre ein Widerspruch: Es läuft, es wird
-- bezahlt, und ausgeblendet fiele niemandem auf, dass es noch da ist. Die
-- Datenbank hält das fest, damit es nicht nur im Formular geprüft wird.
do $$ begin
  alter table public.packages
    add constraint packages_nur_beendete_archivieren
    check (archiviert_am is null or status <> 'active');
exception when duplicate_object then null; end $$;

-- Die Übersicht filtert künftig danach. Ein Teilindex genügt, archiviert
-- wird selten und gelesen wird fast immer das Gegenteil.
create index if not exists packages_nicht_archiviert_idx
  on public.packages (student_id)
  where archiviert_am is null;
