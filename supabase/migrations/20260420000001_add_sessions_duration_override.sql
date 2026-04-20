-- Migration: distinguish user-overridden duration from auto-followed duration
-- When true, __setDuration reports from the compiled component are ignored so the
-- user's manual value isn't overwritten on every refresh.
alter table sessions add column if not exists duration_override boolean not null default false;
