-- Calobit account binding + cloud backup (v1.8)
--
-- Run this in the existing payments Supabase project (SQL editor).
-- Unlike pending_checkouts (service-role only), these tables are read/written
-- directly by the signed-in client via supabase-js, so RLS policies are keyed
-- on auth.uid() — Supabase validates the session token automatically and a
-- user can only ever see their own row.
--
-- user_id defaults to auth.uid() so client upserts that omit it still get
-- stamped with the authenticated user id (and pass the RLS with-check). The
-- client also sends user_id explicitly; the default is a safety net for
-- already-installed builds.

create table if not exists bound_accounts (
  user_id      text primary key default auth.uid()::text,  -- Supabase auth user id (uuid::text)
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists user_backups (
  user_id    text primary key default auth.uid()::text references bound_accounts(user_id) on delete cascade,
  data       jsonb not null,              -- { suffix: rawValue, ... } per localStorage key
  bytes      integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table bound_accounts enable row level security;
alter table user_backups enable row level security;

-- Users can only touch their own rows. auth.uid() returns uuid; compare as text.
create policy "bound_accounts_own_row" on bound_accounts
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "user_backups_own_row" on user_backups
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
