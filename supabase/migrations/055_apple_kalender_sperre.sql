-- ============================================================
-- Apple-Kalender als Sperrzeit
-- Angewendet am 2026-08-20.
--
-- David trägt Privates in seinen Apple-Kalender ein und will nicht daran
-- denken, es hier nochmals zu sperren. Ein öffentlicher iCal-Link wird
-- regelmässig abgerufen, und jeder Termin darin wird zu einer Sperrzeit.
--
-- Die Termine landen in `time_blocks` und nicht in einer eigenen Tabelle.
-- Der Grund ist wichtig: An `time_blocks` hängen bereits Buchungs-Engine,
-- Routenplanung und Zuteilung. Eine neue Tabelle müsste an jeder dieser
-- Stellen einzeln eingehängt werden, und die eine vergessene Stelle wäre
-- genau die, die einen Schüler auf Davids Zahnarzttermin legt.
--
-- `quelle` trennt Importiertes von Handgemachtem: Beim nächsten Abgleich
-- werden nur die importierten Zeilen weggeworfen und neu geschrieben,
-- Davids eigene Sperren bleiben unangetastet.
-- ============================================================

alter table public.time_blocks
  add column if not exists quelle text not null default 'manuell'
    check (quelle in ('manuell','apple')),
  add column if not exists extern_uid text;

comment on column public.time_blocks.quelle is
  'manuell = von Hand angelegt, apple = aus dem iCal-Abo importiert.';
comment on column public.time_blocks.extern_uid is
  'UID des Kalendereintrags, damit derselbe Termin nicht doppelt landet.';

-- Ein importierter Termin genau einmal pro Tag. Wiederkehrende Termine
-- teilen sich eine UID, unterscheiden sich aber im Datum.
create unique index if not exists time_blocks_apple_eindeutig
  on public.time_blocks (extern_uid, date)
  where quelle = 'apple';

create index if not exists time_blocks_quelle on public.time_blocks (quelle);

