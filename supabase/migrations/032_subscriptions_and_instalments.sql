-- 032: Abo-Modell — Ratenkauf, Anzahlung, Auto-Verlängerung
-- Angewendet am 2026-08-07.

-- === 1. packages um Abo-/Raten-Felder erweitern ======================

alter table public.packages
  add column if not exists billing_mode text not null default 'einmalig',
  add column if not exists term_months smallint,
  add column if not exists deposit_amount numeric(10,2),
  add column if not exists instalment_count smallint,
  add column if not exists instalment_amount numeric(10,2),
  add column if not exists auto_renew boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists renewed_from_package_id uuid references public.packages(id) on delete set null,
  add column if not exists renewal_notice_sent_at timestamptz,
  add column if not exists expiry_warning_sent_at timestamptz;

do $$ begin
  alter table public.packages add constraint packages_billing_mode_check
    check (billing_mode in ('einmalig','raten'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.packages add constraint packages_term_months_check
    check (term_months is null or term_months between 1 and 24);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.packages add constraint packages_deposit_check
    check (deposit_amount is null or deposit_amount >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.packages add constraint packages_instalment_count_check
    check (instalment_count is null or instalment_count between 0 and 24);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.packages add constraint packages_instalment_amount_check
    check (instalment_amount is null or instalment_amount >= 0);
exception when duplicate_object then null; end $$;

-- Ratenkauf braucht Laufzeit, Anzahlung und Ratenanzahl.
do $$ begin
  alter table public.packages add constraint packages_raten_complete_check
    check (
      billing_mode <> 'raten'
      or (term_months is not null and deposit_amount is not null
          and instalment_count is not null and instalment_amount is not null)
    );
exception when duplicate_object then null; end $$;

-- 'scheduled' = für Auto-Verlängerung vorbereitetes Folgepaket.
-- Der Unique-Index packages_one_active_per_student greift nur bei
-- status='active' und blockiert 'scheduled' daher nicht.
alter table public.packages drop constraint if exists packages_status_check;
alter table public.packages add constraint packages_status_check
  check (status in ('scheduled','active','exhausted','cancelled','expired'));

-- === 2. Raten-Tabelle ================================================

create table if not exists public.package_instalments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  sequence smallint not null,
  kind text not null check (kind in ('anzahlung','rate')),
  amount numeric(10,2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'open'
    check (status in ('open','invoiced','pending_confirmation','paid','overdue','cancelled')),
  invoice_id uuid references public.invoices(id) on delete set null,
  paid_at timestamptz,
  reminder_sent_at timestamptz,
  overdue_notified_at timestamptz,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (package_id, sequence)
);

create index if not exists package_instalments_due_idx
  on public.package_instalments (due_date)
  where status in ('open','invoiced','pending_confirmation','overdue');

create index if not exists package_instalments_package_idx
  on public.package_instalments (package_id);

create index if not exists package_instalments_student_idx
  on public.package_instalments (student_id);

-- === 3. aktualisiert_am automatisch pflegen ==========================

create or replace function public.touch_package_instalments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.aktualisiert_am := now();
  return new;
end;
$$;

drop trigger if exists package_instalments_touch on public.package_instalments;
create trigger package_instalments_touch
  before update on public.package_instalments
  for each row execute function public.touch_package_instalments();

-- === 4. RLS ==========================================================

alter table public.package_instalments enable row level security;

drop policy if exists "Schüler liest eigene Raten" on public.package_instalments;
create policy "Schüler liest eigene Raten" on public.package_instalments
  for select using (student_id = own_profile_id() or is_admin());

drop policy if exists "Nur Admin schreibt Raten" on public.package_instalments;
create policy "Nur Admin schreibt Raten" on public.package_instalments
  for insert with check (is_admin());

drop policy if exists "Nur Admin aktualisiert Raten" on public.package_instalments;
create policy "Nur Admin aktualisiert Raten" on public.package_instalments
  for update using (is_admin());

drop policy if exists "Nur Admin löscht Raten" on public.package_instalments;
create policy "Nur Admin löscht Raten" on public.package_instalments
  for delete using (is_admin());

-- === 5. invoices: Bezug zur Rate =====================================

alter table public.invoices
  add column if not exists instalment_id uuid references public.package_instalments(id) on delete set null;

create index if not exists invoices_instalment_idx on public.invoices (instalment_id);

-- === 6. Bestandsdaten ================================================

update public.packages
   set billing_mode = 'einmalig'
 where billing_mode is null;
