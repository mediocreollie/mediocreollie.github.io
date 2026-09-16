-- Fit Reference: run once in Supabase SQL Editor.
begin;
create table if not exists public.fit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision integer not null default 1 check (revision > 0)
);
alter table public.fit_accounts enable row level security;
revoke all on public.fit_accounts from anon, authenticated;
grant select, insert, update, delete on public.fit_accounts to authenticated;
drop policy if exists fit_owner on public.fit_accounts;
create policy fit_owner on public.fit_accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
commit;
