-- ============================================================
-- Abonnierbarer Kalender: ein Token je Schüler
--
-- Kalender-Abos (webcal://) kommen ohne Login aus: Apple, Google und
-- Outlook holen die Adresse im Hintergrund, ohne Sitzung, ohne Cookie. Der
-- Zugriffsschutz ist also der Link selbst. Darum ein langer Zufallswert je
-- Schüler, und er lässt sich zurücksetzen, falls ein Link weitergegeben
-- wurde: Der alte hört sofort auf zu funktionieren.
--
-- Der Admin-Feed (alle Lektionen, mit Adressen) hängt an einem eigenen
-- Token in app_settings, nicht an einem Profil.
-- ============================================================

alter table public.profiles
  add column if not exists kalender_token text unique;

comment on column public.profiles.kalender_token is
  'Zufallswert fuer den abonnierbaren Kalender des Schuelers. NULL = noch nie erzeugt. Zuruecksetzen = neuer Wert, alter Link tot.';

-- Nachschlagen nach Token passiert bei jedem Abruf durch die Kalender-App,
-- bei Apple alle 15 Minuten bis stuendlich. Ohne Index ein Full Scan.
create index if not exists profiles_kalender_token_idx
  on public.profiles (kalender_token)
  where kalender_token is not null;
