-- Migration: create_history_tables
-- Creates sessions and code_snapshots tables for undo/redo history

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text
);

create table if not exists code_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  code text not null,
  prompt text,
  summary text,
  skills text[],
  sequence_number integer not null,
  created_at timestamptz default now()
);

create index if not exists code_snapshots_session_id_idx
  on code_snapshots(session_id, sequence_number);

-- Enable RLS
alter table sessions enable row level security;
alter table code_snapshots enable row level security;

-- Allow anonymous users full access (no auth required)
create policy "anon_all_sessions"
  on sessions for all
  to anon
  using (true)
  with check (true);

create policy "anon_all_code_snapshots"
  on code_snapshots for all
  to anon
  using (true)
  with check (true);
