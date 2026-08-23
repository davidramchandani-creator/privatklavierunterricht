-- ============================================================
-- Mahnwesen für offene Rechnungen
--
-- Bisher wurde nur bei **Raten** überfällig markiert. Eine einzelne
-- Lektionsrechnung lag still herum, bis David selbst nachsah — bei 65 bis
-- 70 Franken pro Lektion genau die Sorte Geld, die man nach drei Monaten
-- nicht mehr einfordern mag.
--
-- Zwei Arten von Stillstand, die man nicht verwechseln darf:
--
--   unpaid + überfällig    Der Schüler hat nicht bezahlt → er wird erinnert.
--   pending_confirmation   Der Schüler sagt, er habe bezahlt, David hat es
--                          nicht bestätigt → **David** wird erinnert. Hier
--                          eine Mahnung an den Schüler zu schicken wäre
--                          peinlich: Er hat seinen Teil getan.
--
-- `mahnstufe` zählt die Erinnerungen an den Schüler, `erinnert_am` hält
-- fest, wann zuletzt. Beides zusammen verhindert, dass der tägliche Cron
-- jeden Morgen dieselbe Mail schickt.
-- ============================================================

alter table invoices
  add column if not exists erinnert_am timestamptz;

alter table invoices
  add column if not exists mahnstufe smallint not null default 0;

-- Wann David zuletzt darauf hingewiesen wurde, dass eine gemeldete Zahlung
-- auf seine Bestätigung wartet. Eigene Spalte, weil es ein anderer
-- Empfänger und ein anderer Anlass ist.
alter table invoices
  add column if not exists bestaetigung_erinnert_am timestamptz;

comment on column invoices.mahnstufe is
  'Wie oft der Schüler an diese Rechnung erinnert wurde. 0 = noch nie.';
comment on column invoices.erinnert_am is
  'Zeitpunkt der letzten Erinnerung an den Schüler.';
comment on column invoices.bestaetigung_erinnert_am is
  'Zeitpunkt des letzten Hinweises an David, eine gemeldete Zahlung zu bestätigen.';

-- Der Job sucht täglich nach offenen Rechnungen. Ohne Index wäre das ein
-- Full Scan pro Lauf.
create index if not exists invoices_offen_faellig
  on invoices (status, due_date)
  where paid_at is null;
