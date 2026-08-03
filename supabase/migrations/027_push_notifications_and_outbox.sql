-- Migration 027: Web-Push-Abos + Outbox-Erweiterung für Reminder + Kontaktformular.
-- (Am 2026-08-03 direkt auf der Live-DB angewendet.)

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  failure_count smallint not null default 0,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Eigene Push-Abos lesen" on public.push_subscriptions;
create policy "Eigene Push-Abos lesen" on public.push_subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Eigene Push-Abos anlegen" on public.push_subscriptions;
create policy "Eigene Push-Abos anlegen" on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists "Eigene Push-Abos loeschen" on public.push_subscriptions;
create policy "Eigene Push-Abos loeschen" on public.push_subscriptions
  for delete using (user_id = auth.uid() or public.is_admin());

alter table public.scheduled_emails
  add column if not exists dedupe_key text,
  add column if not exists channel text not null default 'both'
    check (channel in ('email', 'push', 'both'));

create unique index if not exists scheduled_emails_dedupe_key_uniq
  on public.scheduled_emails (dedupe_key)
  where dedupe_key is not null;

create index if not exists scheduled_emails_due_idx
  on public.scheduled_emails (send_at)
  where status = 'pending';

alter table public.anfragen
  add column if not exists quelle text not null default 'probelektion'
    check (quelle in ('probelektion', 'kontakt')),
  add column if not exists betreff text;
