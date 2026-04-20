-- Migration: soft-delete flag for sessions
-- deleted=true hides the session from the home page list without dropping its snapshots
alter table sessions add column if not exists deleted boolean not null default false;
create index if not exists sessions_deleted_idx on sessions (deleted) where deleted = false;
