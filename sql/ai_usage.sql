-- Monthly AI usage budget for /api/ai/gemini (see api/_lib/ai.js).
-- One row per user per calendar month. RLS on, no policies — only the
-- service-role key (which bypasses RLS) touches this table.

create table if not exists ai_usage (
  user_id text not null,
  month text not null,
  count integer not null default 0,
  primary key (user_id, month)
);

alter table ai_usage enable row level security;
