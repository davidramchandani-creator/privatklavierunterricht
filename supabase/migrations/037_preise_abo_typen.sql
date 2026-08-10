-- 037: Globale Richtwert-Preise um die Abo-Typen erweitern.
-- Angewendet am 2026-08-10.
--
-- Die `preise`-Tabelle dient nur der Anzeige im Admin; verbindlich sind die
-- Preise pro Schüler in profiles.price_halbjahr / price_jahr. Trotzdem soll
-- dort nicht "10er-Paket" stehen, wenn es keine 10er-Pakete mehr gibt.

alter table public.preise drop constraint if exists preise_typ_check;
alter table public.preise add constraint preise_typ_check
  check (typ in ('einzellektion','10er','20er','halbjahr','jahr'));

insert into public.preise (typ, preis_pro_lektion)
values ('halbjahr', 70), ('jahr', 65)
on conflict (typ) do nothing;
