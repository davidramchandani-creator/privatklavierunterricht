-- ============================================================
-- Fixplatz mit noch offenem Termin
--
-- Die alte Regel sagte: booking_mode 'fix' heisst, der Platz steht bereits.
-- Das stimmt nicht mehr. Es gibt einen dritten, völlig regulären Zustand:
-- Fixplatz vereinbart, Termin noch offen — die Planung setzt ihn.
--
-- Genau dieser Zustand ist der Regelfall, sobald mehrere Schüler zusammen
-- verplant werden: Erst sagen alle, wann sie können, dann entscheidet die
-- Zuteilung über alle zugleich.
--
-- Was die Regel weiterhin verhindert, ist der *halbe* Zustand: ein Wochentag
-- ohne Uhrzeit oder umgekehrt. Der wäre ein Datenfehler, während „beides
-- offen" eine Aussage ist.
-- ============================================================

alter table packages drop constraint if exists packages_fixplatz_complete_check;

alter table packages add constraint packages_fixplatz_complete_check
  check (
    booking_mode <> 'fix'
    or (
      rhythmus is not null
      and (
        (fixplatz_weekday is not null and fixplatz_time is not null)
        or (fixplatz_weekday is null and fixplatz_time is null)
      )
    )
  );
