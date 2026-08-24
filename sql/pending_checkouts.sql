-- pending_checkouts (run in Calobit's own Supabase project, SQL editor)
--
-- Binds PayGate order IDs to local Calobit usernames. PayGate only knows
-- order IDs; this table is how a PAID order maps back to the account whose
-- checkout created it, and the `activated` flag makes status-poll activation
-- idempotent.
--
-- Deviations from the original spec's sketch:
--   * user_id is text (the local username), not uuid referencing auth.users —
--     Calobit's auth is local-first and has no Supabase auth schema.
--   * amount + expires_at are stored so an unexpired checkout can be resumed
--     server-side without re-calling PayGate.
--
-- RLS is enabled with no policies: the anon key can't read or write anything.
-- Only the service-role key used by the /api/checkout/* functions touches it.

create table if not exists pending_checkouts (
  order_id   text primary key,      -- matches PayGate's order_id (CB-XXXXX)
  user_id    text not null,         -- local Calobit username
  plan       text not null,
  amount     integer not null default 250,
  expires_at timestamptz not null,
  activated  boolean not null default false,
  created_at timestamptz not null default now()
);

alter table pending_checkouts enable row level security;

create index if not exists pending_checkouts_user_idx
  on pending_checkouts (user_id, activated, expires_at);
