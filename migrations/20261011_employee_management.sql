-- DAST ERP: employee management fields
-- REVIEW ONLY: this migration is not applied to any Supabase project by this change.
-- Confirm existing profile column names and data before running in a controlled migration window.
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists job_title text,
  add column if not exists role text not null default 'employee',
  add column if not exists employee_code text,
  add column if not exists is_active boolean not null default true;

create unique index if not exists profiles_employee_code_unique
  on public.profiles (employee_code)
  where employee_code is not null and employee_code <> '';

-- The endpoint uses the server-only service key and performs an explicit admin check.
-- Do not add broad anon/authenticated write policies for these fields.
